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

/** Browser Web Speech API — free, no API token. Syncs segments via REST + socket. */
export function useLiveSpeechToText(
  bookingId: string | undefined,
  enabled: boolean,
  userLang?: string,
) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionInstance | null>(null);
  const listeningRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    listeningRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!bookingId || !enabled) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Live speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    stop();

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechRecognitionLang(userLang);
    recRef.current = rec;
    listeningRef.current = true;

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

    rec.onerror = (e: any) => {
      const errCode = e?.error;
      console.warn('[SpeechToText] SpeechRecognition error:', errCode, e);

      if (errCode === 'no-speech' || errCode === 'aborted') {
        return;
      }

      let msg = 'Speech recognition interrupted. Tap Start listening to resume.';
      if (errCode === 'not-allowed') {
        msg = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
      } else if (errCode === 'audio-capture') {
        msg = 'No microphone was found or the microphone is busy.';
      } else if (errCode === 'network') {
        msg = 'Network error. Chrome speech recognition requires an internet connection.';
      } else if (errCode) {
        msg = `Speech recognition error (${errCode}). Tap Start listening to resume.`;
      }

      setError(msg);
      listeningRef.current = false;
      setListening(false);
    };

    rec.onend = () => {
      if (listeningRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {
          listeningRef.current = false;
          setListening(false);
        }
      }
    };

    try {
      rec.start();
      setListening(true);
      setError(null);
    } catch {
      setError('Could not start microphone for transcription.');
      listeningRef.current = false;
    }
  }, [bookingId, enabled, userLang, stop]);

  useEffect(() => {
    if (!enabled) stop();
    return () => stop();
  }, [enabled, stop]);

  return { supported, listening, error, start, stop };
}
