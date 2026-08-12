import React, { useEffect, useRef, useState } from 'react';

const POSTER_SRC = '/landing/hero-poster.png';
const VIDEO_WEBM = '/landing/hero-loop.webm';
const VIDEO_MP4 = '/landing/hero-loop.mp4';

/**
 * Hero background: looping video when assets exist, else animated poster (Ken Burns).
 */
export const LandingHeroBackground: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useVideo, setUseVideo] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setUseVideo(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    const onError = () => setUseVideo(false);
    const onCanPlay = () => {
      void video.play().catch(() => setUseVideo(false));
    };

    video.addEventListener('error', onError);
    video.addEventListener('canplay', onCanPlay);
    return () => {
      video.removeEventListener('error', onError);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [reducedMotion]);

  const showVideo = useVideo && !reducedMotion;

  return (
    <div
      className={`landing-hero__bg${showVideo ? '' : ' landing-hero__bg--static'}`}
      aria-hidden
    >
      {showVideo && (
        <video
          ref={videoRef}
          className="landing-hero__bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER_SRC}
        >
          <source src={VIDEO_WEBM} type="video/webm" />
          <source src={VIDEO_MP4} type="video/mp4" />
        </video>
      )}
      <img
        className={`landing-hero__bg-poster${showVideo ? ' landing-hero__bg-poster--under' : ' landing-hero__bg-poster--animate'}`}
        src={POSTER_SRC}
        alt=""
        decoding="async"
        fetchPriority="high"
      />
    </div>
  );
};

export default LandingHeroBackground;
