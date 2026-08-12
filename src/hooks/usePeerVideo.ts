import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type MediaConnection } from 'peerjs';

export type VideoConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * PeerJS WebRTC — uses free public PeerServer by default (no API token).
 * Override with VITE_PEERJS_HOST / VITE_PEERJS_PATH for self-host.
 */
export function usePeerVideo(
  roomId: string | null | undefined,
  role: 'citizen' | 'lawyer',
  active: boolean,
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<VideoConnectionState>('idle');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const peerId = roomId ? `ox-${roomId}-${role}` : null;
  const remotePeerId = roomId
    ? `ox-${roomId}-${role === 'citizen' ? 'lawyer' : 'citizen'}`
    : null;

  const cleanup = useCallback(() => {
    callRef.current?.close();
    callRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setState('idle');
  }, []);

  useEffect(() => {
    if (!active || !peerId || !remotePeerId) {
      cleanup();
      return;
    }

    let cancelled = false;
    setState('connecting');
    setError(null);

    const host = import.meta.env.VITE_PEERJS_HOST as string | undefined;
    const path = import.meta.env.VITE_PEERJS_PATH as string | undefined;
    const secure = import.meta.env.VITE_PEERJS_SECURE === 'true';

    const peerOpts: ConstructorParameters<typeof Peer>[1] = host
      ? { host, path: path || '/peerjs', secure }
      : undefined;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);

        const peer = new Peer(peerId, peerOpts);
        peerRef.current = peer;

        peer.on('error', (e) => {
          if (!cancelled) {
            setError(e.message || 'Video connection failed.');
            setState('error');
          }
        });

        peer.on('open', () => {
          if (cancelled) return;
          if (role === 'lawyer') {
            const call = peer.call(remotePeerId, stream);
            callRef.current = call;
            wireCall(call);
          }
        });

        peer.on('call', (call) => {
          if (cancelled) return;
          call.answer(stream);
          callRef.current = call;
          wireCall(call);
        });

        function wireCall(call: MediaConnection) {
          call.on('stream', (remote) => {
            if (!cancelled) {
              setRemoteStream(remote);
              setState('connected');
            }
          });
          call.on('close', () => {
            if (!cancelled) setRemoteStream(null);
          });
          call.on('error', () => {
            if (!cancelled) setState('error');
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Camera/microphone access is required for video.',
          );
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, peerId, remotePeerId, role, cleanup]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, [muted]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !videoOff;
    });
  }, [videoOff]);

  return {
    localStream,
    remoteStream,
    state,
    error,
    muted,
    videoOff,
    setMuted,
    setVideoOff,
    peerId,
  };
}
