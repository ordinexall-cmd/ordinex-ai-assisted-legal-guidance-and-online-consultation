import { useCallback, useEffect, useRef, useState } from 'react';
import { bookingsApi } from '../services/api';
import { speechRecognitionLang } from '../utils/speechLang';

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => RecognitionInstance) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => RecognitionInstance;
    webkitSpeechRecognition?: new () => RecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Length of each audio clip sent to Gemini. */
const CHUNK_MS = 5000;
/** Skip near-silent clips (average peak from AnalyserNode over the chunk). */
const SILENCE_RMS = 0.025;

function pickAudioMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

/** True when text has no real speech content (e.g. "." alone). */
function isNonSpeechText(text: string): boolean {
  const t = text.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
  if (!t) return true;
  if (!/\p{L}|\p{N}/u.test(t)) return true;
  return /^(silence|\[silence\]|\(silence\)|no[- ]?speech|inaudible|\.+|…+)$/i.test(t);
}

/**
 * Live speech-to-text via Gemini (server).
 * Captures short mic clips and uploads them. Falls back to browser Web Speech
 * only when MediaRecorder / getUserMedia is unavailable.
 */
export function useLiveSpeechToText(
  bookingId: string | undefined,
  enabled: boolean,
  userLang?: string,
) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const listeningRef = useRef(false);
  const mimeRef = useRef<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const peakRmsRef = useRef(0);

  const recRef = useRef<RecognitionInstance | null>(null);
  const usingFallbackRef = useRef(false);

  useEffect(() => {
    const canRecord =
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia);
    setSupported(canRecord || Boolean(getRecognitionCtor()));
  }, []);

  const teardownAudioMeter = useCallback(() => {
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    peakRmsRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    teardownAudioMeter();
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
    usingFallbackRef.current = false;
    setListening(false);
  }, [teardownAudioMeter]);

  const samplePeakRms = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const n = (data[i] - 128) / 128;
      sum += n * n;
    }
    const rms = Math.sqrt(sum / data.length);
    if (rms > peakRmsRef.current) peakRmsRef.current = rms;
  }, []);

  const startWebSpeech = useCallback(() => {
    if (!bookingId) return false;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return false;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechRecognitionLang(userLang);
    recRef.current = rec;
    usingFallbackRef.current = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = result[0]?.transcript?.trim();
        if (!text || isNonSpeechText(text)) continue;
        void bookingsApi.appendTranscriptSegment(bookingId, {
          text,
          lang: userLang || 'en',
          isFinal: true,
        });
      }
    };

    rec.onerror = (e?: { error?: string }) => {
      const errCode = e?.error;
      if (errCode === 'no-speech' || errCode === 'aborted') return;
      let msg = 'Speech recognition interrupted. Tap Start listening to resume.';
      if (errCode === 'not-allowed') {
        msg = 'Microphone permission denied. Please allow microphone access and try again.';
      } else if (errCode === 'audio-capture') {
        msg = 'No microphone was found or the microphone is busy.';
      } else if (errCode === 'network') {
        msg = 'Network error. Speech recognition requires an internet connection.';
      }
      setError(msg);
      listeningRef.current = false;
      setListening(false);
    };

    rec.onend = () => {
      if (listeningRef.current && recRef.current === rec) {
        try { rec.start(); } catch {
          listeningRef.current = false;
          setListening(false);
        }
      }
    };

    try {
      rec.start();
      return true;
    } catch {
      return false;
    }
  }, [bookingId, userLang]);

  const recordClip = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !listeningRef.current || !bookingId) return;

    let recorder: MediaRecorder;
    try {
      recorder = mimeRef.current
        ? new MediaRecorder(stream, { mimeType: mimeRef.current })
        : new MediaRecorder(stream);
    } catch {
      return;
    }
    recorderRef.current = recorder;
    const parts: BlobPart[] = [];
    peakRmsRef.current = 0;
    const meterTimer = window.setInterval(samplePeakRms, 200);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) parts.push(e.data);
    };

    recorder.onstop = () => {
      clearInterval(meterTimer);
      samplePeakRms();
      const blob = new Blob(parts, { type: mimeRef.current || 'audio/webm' });
      const loudEnough = peakRmsRef.current >= SILENCE_RMS;
      // Quiet clips: do not upload at all (avoids Gemini inventing ".")
      if (blob.size > 2200 && loudEnough) {
        void bookingsApi
          .appendTranscriptAudio(bookingId, blob, userLang)
          .catch((err) => console.warn('[SpeechToText] Gemini upload failed:', err?.message || err));
      }
      if (listeningRef.current) recordClip();
    };

    try {
      recorder.start();
      setError(null);
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch { /* ignore */ }
        }
      }, CHUNK_MS);
    } catch {
      clearInterval(meterTimer);
      if (!startWebSpeech()) {
        setError('Could not start microphone for transcription.');
        listeningRef.current = false;
        setListening(false);
      }
    }
  }, [bookingId, userLang, startWebSpeech, samplePeakRms]);

  const start = useCallback(async () => {
    if (!bookingId || !enabled) return;
    stop();
    listeningRef.current = true;

    const canRecord =
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia);

    if (canRecord) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!listeningRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        mimeRef.current = pickAudioMime();
        try {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new Ctx();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;
        } catch {
          // Meter optional — server still filters punctuation-only.
        }
        setListening(true);
        setError(null);
        recordClip();
        return;
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Microphone permission denied. Please allow microphone access and try again.');
          listeningRef.current = false;
          setListening(false);
          return;
        }
      }
    }

    if (startWebSpeech()) {
      setListening(true);
      setError(null);
    } else {
      setError('Live transcription is not supported in this browser. Try Chrome or Edge.');
      listeningRef.current = false;
      setListening(false);
    }
  }, [bookingId, enabled, stop, recordClip, startWebSpeech]);

  useEffect(() => {
    if (!enabled) stop();
    return () => stop();
  }, [enabled, stop]);

  return { supported, listening, error, start, stop };
}
