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
    if (localStream.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(localStream).connect(dest);
    }

    const mixed = new MediaStream();
    const videoTracks = remoteStream.getVideoTracks().length > 0
      ? remoteStream.getVideoTracks()
      : localStream.getVideoTracks();

    for (const vt of videoTracks) mixed.addTrack(vt);
    for (const at of dest.stream.getAudioTracks()) mixed.addTrack(at);
    return mixed;
  } catch {
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
  onRecordingUploadDone,
}) => {
  const active = booking.status === 'IN_PROGRESS' || booking.status === 'CONFIRMED';
  const video = usePeerVideo(booking.roomId, role, active && Boolean(booking.roomId));

  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [swapped, setSwapped] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mainStream = swapped ? video.localStream : video.remoteStream;
  const pipStream = swapped ? video.remoteStream : video.localStream;
  const mainIsLocal = swapped;

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = mainStream;
  }, [mainStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = pipStream;
  }, [pipStream]);

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

  const handleEndCall = useCallback(async () => {
    if (recording) await stopRecording();
    if (video.screenSharing) await video.stopScreenShare();
    onEndCall();
  }, [recording, stopRecording, onEndCall, video]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const showMainVideo = Boolean(mainStream);
  const statusText = video.state === 'connecting'
    ? 'Connecting video…'
    : video.state === 'error'
      ? (video.error || 'Video unavailable')
      : 'Waiting for the other participant…';

  return (
    <section className="video-stage" aria-label="Video call">
      <div className="video-stage__canvas">
        {showMainVideo ? (
          <video
            ref={remoteRef}
            className="video-stage__remote"
            autoPlay
            playsInline
            muted={mainIsLocal}
          />
        ) : (
          <div className="video-stage__placeholder">
            <span className="material-symbols-outlined">videocam</span>
            <p>{statusText}</p>
            {booking.roomId && (
              <p className="video-stage__room">room {booking.roomId.slice(0, 8)}…</p>
            )}
          </div>
        )}

        <div className="video-stage__live">
          <span className="video-stage__live-dot" aria-hidden />
          {swapped ? selfLabel : (peerName || 'Participant')}
          {video.state === 'connected' && ' · Live'}
        </div>

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

        <button
          type="button"
          className="video-stage__pip"
          onClick={() => setSwapped((v) => !v)}
          title="Tap to swap views"
          aria-label="Swap local and remote video"
        >
          {pipStream ? (
            <video
              ref={localRef}
              className="video-stage__local"
              autoPlay
              playsInline
              muted={!swapped}
            />
          ) : (
            <span className="material-symbols-outlined">person</span>
          )}
          <span className="video-stage__pip-label">
            {swapped ? (peerName || 'Them') : selfLabel}
          </span>
        </button>

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
            disabled={video.screenSharing}
          >
            <span className="material-symbols-outlined">{video.videoOff ? 'videocam_off' : 'videocam'}</span>
          </button>
          <button
            type="button"
            className={`video-stage__ctrl${video.screenSharing ? ' video-stage__ctrl--active' : ''}`}
            aria-label={video.screenSharing ? 'Stop sharing screen' : 'Share screen'}
            onClick={() => (video.screenSharing ? video.stopScreenShare() : video.startScreenShare())}
          >
            <span className="material-symbols-outlined">
              {video.screenSharing ? 'stop_screen_share' : 'present_to_all'}
            </span>
          </button>
          <button
            type="button"
            className={`video-stage__ctrl${recording ? ' video-stage__ctrl--recording' : ''}`}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            onClick={() => (recording ? stopRecording() : startRecording())}
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
