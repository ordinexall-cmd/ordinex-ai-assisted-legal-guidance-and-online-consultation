import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type MediaConnection } from 'peerjs';

export type VideoConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

const CALL_RETRY_MS = 2500;
const CALL_RETRY_MAX = 40;

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
  if (raw?.trim()) {
    try {
      const parsed = JSON.parse(raw) as RTCIceServer[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      console.warn('[usePeerVideo] VITE_ICE_SERVERS is not valid JSON; using defaults + TURN env.');
    }
  }

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl?.trim()) {
    servers.push({
      urls: turnUrl.trim(),
      username: (import.meta.env.VITE_TURN_USERNAME as string | undefined) || undefined,
      credential: (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || undefined,
    });
  }

  return servers;
}

/**
 * PeerJS WebRTC for 1:1 consults.
 * Default: public PeerServer. Optional host via VITE_PEERJS_*.
 * Optional TURN via VITE_TURN_* or VITE_ICE_SERVERS (JSON).
 * Both roles retry outbound calls so join order does not matter.
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
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const connectedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);

  const peerId = roomId ? `ox-${roomId}-${role}` : null;
  const remotePeerId = roomId
    ? `ox-${roomId}-${role === 'citizen' ? 'lawyer' : 'citizen'}`
    : null;

  const stopDisplayShare = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryCountRef.current = 0;
    connectedRef.current = false;
    callRef.current?.close();
    callRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    stopDisplayShare();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cameraTrackRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setScreenSharing(false);
    setState('idle');
  }, [stopDisplayShare]);

  const replaceOutboundVideo = useCallback(async (track: MediaStreamTrack) => {
    const pc = callRef.current?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;
    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (videoSender) await videoSender.replaceTrack(track);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!streamRef.current) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const displayTrack = display.getVideoTracks()[0];
      if (!displayTrack) {
        display.getTracks().forEach((t) => t.stop());
        return;
      }
      stopDisplayShare();
      displayStreamRef.current = display;

      const cam = streamRef.current.getVideoTracks()[0];
      if (cam && !cameraTrackRef.current) cameraTrackRef.current = cam;

      await replaceOutboundVideo(displayTrack);
      streamRef.current.removeTrack(cam);
      streamRef.current.addTrack(displayTrack);
      setLocalStream(new MediaStream(streamRef.current.getTracks()));
      setScreenSharing(true);
      setVideoOff(false);

      displayTrack.onended = () => {
        void (async () => {
          const restore = cameraTrackRef.current;
          if (restore && streamRef.current) {
            try {
              await replaceOutboundVideo(restore);
              const dt = streamRef.current.getVideoTracks()[0];
              if (dt) streamRef.current.removeTrack(dt);
              streamRef.current.addTrack(restore);
              setLocalStream(new MediaStream(streamRef.current.getTracks()));
            } catch { /* ignore */ }
          }
          stopDisplayShare();
          setScreenSharing(false);
        })();
      };
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === 'NotAllowedError') return;
      setError(e instanceof Error ? e.message : 'Screen share failed.');
    }
  }, [replaceOutboundVideo, stopDisplayShare]);

  const stopScreenShare = useCallback(async () => {
    const restore = cameraTrackRef.current;
    if (restore && streamRef.current) {
      try {
        await replaceOutboundVideo(restore);
        const dt = streamRef.current.getVideoTracks()[0];
        if (dt && dt !== restore) {
          streamRef.current.removeTrack(dt);
          dt.stop();
        }
        if (!streamRef.current.getVideoTracks().includes(restore)) {
          streamRef.current.addTrack(restore);
        }
        setLocalStream(new MediaStream(streamRef.current.getTracks()));
      } catch { /* ignore */ }
    }
    stopDisplayShare();
    setScreenSharing(false);
  }, [replaceOutboundVideo, stopDisplayShare]);

  useEffect(() => {
    if (!active || !peerId || !remotePeerId) {
      cleanup();
      return;
    }

    let cancelled = false;
    connectedRef.current = false;
    setState('connecting');
    setError(null);

    const host = import.meta.env.VITE_PEERJS_HOST as string | undefined;
    const path = import.meta.env.VITE_PEERJS_PATH as string | undefined;
    const secure = import.meta.env.VITE_PEERJS_SECURE === 'true';

    const peerOpts: ConstructorParameters<typeof Peer>[1] = {
      config: { iceServers: buildIceServers() },
      ...(host
        ? { host, path: path || '/peerjs', secure, debug: 1 }
        : { debug: 1 }),
    };

    const wireCall = (call: MediaConnection) => {
      call.on('stream', (remote) => {
        if (cancelled) return;
        connectedRef.current = true;
        setRemoteStream(remote);
        setState('connected');
        setError(null);
        if (retryTimerRef.current) {
          clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      });
      call.on('close', () => {
        if (cancelled) return;
        connectedRef.current = false;
        setRemoteStream(null);
        if (active) setState('connecting');
      });
      call.on('error', () => {
        if (!cancelled && !connectedRef.current) {
          setError('Could not connect media to the other participant. Both should use HTTPS and stay on this page.');
        }
      });
    };

    const tryCall = (peer: Peer, stream: MediaStream) => {
      if (cancelled || connectedRef.current || !remotePeerId) return;
      // Avoid stacking duplicate outbound calls while one is ringing.
      if (callRef.current && callRef.current.open && !connectedRef.current) {
        try { callRef.current.close(); } catch { /* ignore */ }
        callRef.current = null;
      }
      try {
        const call = peer.call(remotePeerId, stream);
        callRef.current = call;
        wireCall(call);
      } catch {
        // Peer not ready yet — retry loop will try again.
      }
    };

    (async () => {
      try {
        if (!window.isSecureContext && location.hostname !== 'localhost') {
          throw new Error(
            'Camera requires a secure connection (HTTPS). Open Ordinex on your deployed HTTPS URL, not plain http:// LAN.',
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        setLocalStream(stream);

        const peer = new Peer(peerId, peerOpts);
        peerRef.current = peer;

        peer.on('error', (e) => {
          if (cancelled) return;
          const msg = e?.type === 'peer-unavailable'
            ? 'Waiting for the other participant to join…'
            : (e.message || 'Video connection failed.');
          // peer-unavailable is expected until the other side opens — keep retrying.
          if (e?.type === 'peer-unavailable') {
            setError(null);
            setState('connecting');
            return;
          }
          if (e?.type === 'unavailable-id') {
            setError('This video seat is already in use. Close other tabs and rejoin.');
            setState('error');
            return;
          }
          if (!connectedRef.current) {
            setError(msg);
            setState('error');
          }
        });

        peer.on('open', () => {
          if (cancelled) return;
          tryCall(peer, stream);
          if (retryTimerRef.current) clearInterval(retryTimerRef.current);
          retryCountRef.current = 0;
          retryTimerRef.current = setInterval(() => {
            if (cancelled || connectedRef.current) {
              if (retryTimerRef.current) clearInterval(retryTimerRef.current);
              retryTimerRef.current = null;
              return;
            }
            retryCountRef.current += 1;
            if (retryCountRef.current > CALL_RETRY_MAX) {
              if (retryTimerRef.current) clearInterval(retryTimerRef.current);
              retryTimerRef.current = null;
              setError(
                'Could not reach the other participant. Both must stay on this page over HTTPS. If you are on different networks, configure TURN (VITE_TURN_URL).',
              );
              setState('error');
              return;
            }
            tryCall(peer, stream);
          }, CALL_RETRY_MS);
        });

        peer.on('call', (call) => {
          if (cancelled) return;
          // Prefer answering the inbound call (other side initiated).
          try { callRef.current?.close(); } catch { /* ignore */ }
          call.answer(stream);
          callRef.current = call;
          wireCall(call);
        });
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
    if (screenSharing) return;
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !videoOff;
    });
  }, [videoOff, screenSharing]);

  return {
    localStream,
    remoteStream,
    state,
    error,
    muted,
    videoOff,
    screenSharing,
    setMuted,
    setVideoOff,
    startScreenShare,
    stopScreenShare,
    peerId,
  };
}
