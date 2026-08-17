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

/** Length of each audio clip sent to Whisper. Short enough to feel "live". */
const CHUNK_MS = 5000;

function pickAudioMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

/**
 * Live speech-to-text.
 *
 * Primary engine: Groq Whisper — we capture short audio clips with
 * MediaRecorder and upload them to the server, which transcribes them to
 * text in the SAME spoken language (en/tl/ceb) and appends transcript
 * segments. Falls back to the browser Web Speech API when microphone
 * capture / MediaRecorder is unavailable.
 */
export function useLiveSpeechToText(
  bookingId: string | undefined,
  enabled: boolean,
  userLang?: string,
) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whisper (MediaRecorder) refs
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const listeningRef = useRef(false);
  const mimeRef = useRef<string>('');

  // Web Speech fallback refs
  const recRef = useRef<RecognitionInstance | null>(null);
  const usingFallbackRef = useRef(false);

  useEffect(() => {
    const canRecord =
      typeof MediaRecorder !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia);
    setSupported(canRecord || Boolean(getRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    // Stop Whisper capture
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Stop Web Speech fallback
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
    usingFallbackRef.current = false;
    setListening(false);
  }, []);

  // --- Browser Web Speech fallback (used only if mic capture is unavailable) ---
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
        if (!text) continue;
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

  // --- Primary: capture a single clip, upload to Whisper, then loop ---
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

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) parts.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(parts, { type: mimeRef.current || 'audio/webm' });
      // Ignore near-empty clips (silence).
      if (blob.size > 1200) {
        void bookingsApi
          .appendTranscriptAudio(bookingId, blob, userLang)
          .catch((err) => console.warn('[SpeechToText] Whisper upload failed:', err?.message || err));
      }
      // Loop while still listening.
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
      // If recording can't start, degrade to Web Speech.
      if (!startWebSpeech()) {
        setError('Could not start microphone for transcription.');
        listeningRef.current = false;
        setListening(false);
      }
    }
  }, [bookingId, userLang, startWebSpeech]);

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
        // Other capture errors → try Web Speech fallback below.
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
