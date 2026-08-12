import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ImageCaptureFieldProps {
  readonly label?: string;
  readonly file: File | null;
  readonly onFileChange: (file: File | null) => void;
  readonly disabled?: boolean;
  readonly captureFileName?: string;
}

type Mode = 'camera' | 'upload';

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export const ImageCaptureField: React.FC<ImageCaptureFieldProps> = ({
  label = 'Photo',
  file,
  onFileChange,
  disabled = false,
  captureFileName = 'verification-photo.jpg',
}) => {
  const [mode, setMode] = useState<Mode>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const revokePreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl((prev) => {
        revokePreview(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      revokePreview(prev);
      return url;
    });
    return () => revokePreview(url);
  }, [file, revokePreview]);

  useEffect(() => {
    if (mode !== 'camera' || disabled || file) {
      stopStream(streamRef.current);
      streamRef.current = null;
      setCameraReady(false);
      return;
    }

    let alive = true;
    setCameraError('');

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not supported in this browser. Use upload instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!alive) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch {
        if (alive) {
          setCameraError('Camera access denied or unavailable. Use upload instead.');
        }
      }
    };

    void start();

    return () => {
      alive = false;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [mode, disabled, file]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream(streamRef.current);
        streamRef.current = null;
        onFileChange(new File([blob], captureFileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    onFileChange(picked);
    e.target.value = '';
  };

  const handleRetake = () => {
    onFileChange(null);
    setCameraError('');
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setCameraError('');
    if (next === 'upload') {
      stopStream(streamRef.current);
      streamRef.current = null;
      setCameraReady(false);
    }
  };

  return (
    <div className="image-capture-field">
      {label && <span className="ox-label">{label}</span>}
      <p className="image-capture-field__privacy">
        Camera preview stays on your device until you capture. Only the photo you submit is uploaded.
      </p>

      {!file && (
        <div className="image-capture-field__tabs" role="tablist" aria-label="Photo source">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'camera'}
            className={`image-capture-field__tab${mode === 'camera' ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => switchMode('camera')}
          >
            Take photo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'upload'}
            className={`image-capture-field__tab${mode === 'upload' ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => switchMode('upload')}
          >
            Upload from gallery
          </button>
        </div>
      )}

      {file && previewUrl ? (
        <div className="image-capture-field__preview">
          <img src={previewUrl} alt="Selected verification preview" />
          <p className="lawyer-verify-form__hint">
            {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
          <button type="button" className="ox-btn ox-btn-ghost" disabled={disabled} onClick={handleRetake}>
            Retake / choose another
          </button>
        </div>
      ) : mode === 'camera' ? (
        <div className="image-capture-field__camera">
          {cameraError ? (
            <p className="image-capture-field__camera-msg">{cameraError}</p>
          ) : (
            <video
              ref={videoRef}
              className="image-capture-field__video"
              playsInline
              muted
              aria-label="Camera preview for verification photo"
            />
          )}
          <canvas ref={canvasRef} className="image-capture-field__canvas" aria-hidden />
          <button
            type="button"
            className="ox-btn ox-btn-secondary"
            disabled={disabled || !cameraReady}
            onClick={handleCapture}
          >
            Capture photo
          </button>
        </div>
      ) : (
        <div className="image-capture-field__upload">
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            capture="user"
            disabled={disabled}
            onChange={handleUploadChange}
          />
        </div>
      )}
    </div>
  );
};

export default ImageCaptureField;
