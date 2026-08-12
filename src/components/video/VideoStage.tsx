import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePeerVideo } from '../../hooks/usePeerVideo';
import { bookingsApi, type Booking } from '../../services/api';

export interface VideoStageProps {
  booking: Booking;
  role: 'citizen' | 'lawyer';
  peerName: string;
  selfLabel: string;
  onOpenChat: () => void;
  onEndCall: () => void;
  /** Start recording once media is available (matches preflight recording policy). */
  autoStartRecording?: boolean;
  /** Notify parent when an upload finishes (success or local fallback). */
  onRecordingUploadDone?: (recordingUrl?: string) => void;
}

/**
 * Mix local + remote audio into a single MediaStream for recording.
 */
function createMixedStream(
  localStream: MediaStream | null,
  remoteStream: MediaStream | null,
): MediaStream | null {
  if (!remoteStream) return localStream;
  if (!localStream) return remoteStream;

  try {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();

    if (remoteStream.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(remoteStream).connect(dest);
    }
    if (localStream && localStream.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(localStream).connect(dest);
    }

    // Use remote video track as the main visual (or local if remote has none)
    const mixed = new MediaStream();
    const videoTracks = remoteStream.getVideoTracks().length > 0
      ? remoteStream.getVideoTracks()
      : localStream.getVideoTracks();

    for (const vt of videoTracks) mixed.addTrack(vt);
    for (const at of dest.stream.getAudioTracks()) mixed.addTrack(at);
    return mixed;
  } catch {
    // Fallback: just use the remote stream
    return remoteStream;
  }
}

export const VideoStage: React.FC<VideoStageProps> = ({
  booking,
  role,
  peerName,
  selfLabel,
  onOpenChat,
  onEndCall,
  autoStartRecording = false,
  onRecordingUploadDone,
}) => {
  const active = booking.status === 'IN_PROGRESS' || booking.status === 'CONFIRMED';
  const video = usePeerVideo(booking.roomId, role, active && Boolean(booking.roomId));

  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = video.remoteStream;
  }, [video.remoteStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = video.localStream;
  }, [video.localStream]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') return;
    const mixed = createMixedStream(video.localStream, video.remoteStream);
    if (!mixed) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    try {
      const recorder = new MediaRecorder(mixed, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch {
      // MediaRecorder not supported
    }
  }, [video.localStream, video.remoteStream]);

  useEffect(() => {
    if (!autoStartRecording || autoStartedRef.current) return;
    if (!video.localStream && !video.remoteStream) return;
    autoStartedRef.current = true;
    startRecording();
  }, [autoStartRecording, video.localStream, video.remoteStream, startRecording]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        setRecording(false);
        recorderRef.current = null;

        if (chunksRef.current.length === 0) { resolve(); return; }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];

        setUploading(true);
        try {
          const res = await bookingsApi.uploadRecording(booking.id, blob);
          onRecordingUploadDone?.(res.recordingUrl);
        } catch {
          // Download locally as a fallback
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `consultation-${booking.id.slice(0, 8)}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          onRecordingUploadDone?.();
        } finally {
          setUploading(false);
        }
        resolve();
      };
      recorder.stop();
    });
  }, [booking.id, onRecordingUploadDone]);

  // Auto-stop recording when call ends
  const handleEndCall = useCallback(async () => {
    if (recording) await stopRecording();
    onEndCall();
  }, [recording, stopRecording, onEndCall]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <section className="video-stage" aria-label="Video call">
      <div className="video-stage__canvas">
        {video.remoteStream ? (
          <video ref={remoteRef} className="video-stage__remote" autoPlay playsInline />
        ) : (
          <div className="video-stage__placeholder">
            <span className="material-symbols-outlined">videocam</span>
            <p>
              {video.state === 'connecting'
                ? 'Connecting video…'
                : video.state === 'error'
                  ? video.error || 'Video unavailable'
                  : 'Waiting for the other participant…'}
            </p>
            {booking.roomId && (
              <p className="video-stage__room">room {booking.roomId.slice(0, 8)}…</p>
            )}
          </div>
        )}

        <div className="video-stage__live">
          <span className="video-stage__live-dot" aria-hidden />
          {peerName || 'Participant'}
          {video.state === 'connected' && ' · Live'}
        </div>

        {/* Recording indicator */}
        {recording && (
          <div className="video-stage__rec-badge" aria-live="polite">
            <span className="video-stage__rec-dot" aria-hidden />
            REC {formatDuration(recordingDuration)}
          </div>
        )}
        {uploading && (
          <div className="video-stage__rec-badge video-stage__rec-badge--upload">
            <span className="spinner-14" aria-hidden />
            Uploading recording…
          </div>
        )}

        <div className="video-stage__pip">
          {video.localStream ? (
            <video ref={localRef} className="video-stage__local" autoPlay playsInline muted />
          ) : (
            <span className="material-symbols-outlined">person</span>
          )}
          <span className="video-stage__pip-label">{selfLabel}</span>
        </div>

        <div className="video-stage__controls">
          <button
            type="button"
            className="video-stage__ctrl"
            aria-label={video.muted ? 'Unmute' : 'Mute'}
            onClick={() => video.setMuted(!video.muted)}
          >
            <span className="material-symbols-outlined">{video.muted ? 'mic_off' : 'mic'}</span>
          </button>
          <button
            type="button"
            className="video-stage__ctrl"
            aria-label={video.videoOff ? 'Camera on' : 'Camera off'}
            onClick={() => video.setVideoOff(!video.videoOff)}
          >
            <span className="material-symbols-outlined">{video.videoOff ? 'videocam_off' : 'videocam'}</span>
          </button>
          {/* Recording toggle */}
          <button
            type="button"
            className={`video-stage__ctrl${recording ? ' video-stage__ctrl--recording' : ''}`}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            onClick={() => recording ? stopRecording() : startRecording()}
            disabled={(!video.remoteStream && !video.localStream) || uploading}
          >
            <span className="material-symbols-outlined">{recording ? 'stop_circle' : 'fiber_manual_record'}</span>
          </button>
          <button type="button" className="video-stage__ctrl" aria-label="Open chat" onClick={onOpenChat}>
            <span className="material-symbols-outlined">chat</span>
          </button>
          <button type="button" className="video-stage__ctrl video-stage__ctrl--end" aria-label="End call" onClick={handleEndCall}>
            <span className="material-symbols-outlined">call_end</span>
          </button>
        </div>
      </div>
    </section>
  );
};
