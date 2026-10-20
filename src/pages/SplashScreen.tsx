import React, { useRef, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => onComplete();
    const handleError = () => onComplete(); // If video fails, skip splash

    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Fallback: in case ended never fires (e.g. can't autoplay)
    const fallback = setTimeout(onComplete, 8000);

    video.play().catch(() => {
      // Autoplay blocked — skip splash immediately
      onComplete();
    });

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      clearTimeout(fallback);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src="/videos/aletwende-vid.mp4"
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="auto"
        style={{ display: 'block' }}
      />
    </div>
  );
};
