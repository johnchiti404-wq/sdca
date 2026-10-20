import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const LIGHTBOX_HISTORY_KEY = '__productImageLightbox';

type ImageLightboxProps = {
  images: string[];
  startIndex: number;
  onClose: () => void;
};

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, startIndex, onClose }) => {
  const historyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const historyEntryActiveRef = useRef(false);
  const closingRef = useRef(false);
  const cleanupTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const boundedStartIndex = Math.max(0, Math.min(startIndex, images.length - 1));
  const [imageIndex, setImageIndex] = useState(boundedStartIndex);
  const currentImage = images[imageIndex];

  const changeImage = useCallback((direction: -1 | 1) => {
    setImageIndex(currentIndex => Math.max(0, Math.min(images.length - 1, currentIndex + direction)));
  }, [images.length]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    const state = window.history.state;
    if (
      historyEntryActiveRef.current &&
      state &&
      typeof state === 'object' &&
      (state as Record<string, unknown>)[LIGHTBOX_HISTORY_KEY] === historyId
    ) {
      historyEntryActiveRef.current = false;
      window.history.back();
    }

    onCloseRef.current();
  }, [historyId]);

  useEffect(() => {
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const currentState = window.history.state;
    const currentHistoryState = currentState && typeof currentState === 'object'
      ? currentState as Record<string, unknown>
      : {};
    if (
      !historyEntryActiveRef.current ||
      currentHistoryState[LIGHTBOX_HISTORY_KEY] !== historyId
    ) {
      window.history.pushState(
        { ...currentHistoryState, [LIGHTBOX_HISTORY_KEY]: historyId },
        '',
        window.location.href,
      );
      historyEntryActiveRef.current = true;
    }
    closingRef.current = false;

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const returnedToLightboxEntry = state && typeof state === 'object' &&
        (state as Record<string, unknown>)[LIGHTBOX_HISTORY_KEY] === historyId;
      if (!historyEntryActiveRef.current || returnedToLightboxEntry) return;

      historyEntryActiveRef.current = false;
      closingRef.current = true;
      onCloseRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (images.length > 1 && event.key === 'ArrowLeft') changeImage(-1);
      if (images.length > 1 && event.key === 'ArrowRight') changeImage(1);

      if (event.key === 'Tab') {
        const focusableButtons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
        if (!focusableButtons?.length) return;

        const firstButton = focusableButtons[0];
        const lastButton = focusableButtons[focusableButtons.length - 1];
        const focusIsOutsideDialog = !dialogRef.current?.contains(document.activeElement);

        if (event.shiftKey && (document.activeElement === firstButton || focusIsOutsideDialog)) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && (document.activeElement === lastButton || focusIsOutsideDialog)) {
          event.preventDefault();
          firstButton.focus();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();

      cleanupTimerRef.current = window.setTimeout(() => {
        const state = window.history.state;
        if (
          historyEntryActiveRef.current &&
          state &&
          typeof state === 'object' &&
          (state as Record<string, unknown>)[LIGHTBOX_HISTORY_KEY] === historyId
        ) {
          historyEntryActiveRef.current = false;
          window.history.back();
        }
        cleanupTimerRef.current = null;
      }, 0);
    };
  }, [changeImage, close, historyId, images.length]);

  if (!currentImage) return null;

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Product image viewer"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={close}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={event => {
          event.stopPropagation();
          close();
        }}
        aria-label="Close image viewer"
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X size={22} aria-hidden="true" />
      </button>

      <motion.div
        className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={event => event.stopPropagation()}
        initial={{ scale: 0.97 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.97 }}
        transition={{ duration: 0.18 }}
      >
        <motion.img
          key={currentImage}
          src={currentImage}
          alt={`Product image ${imageIndex + 1} of ${images.length}`}
          draggable={false}
          className="max-h-[90vh] max-w-[90vw] select-none object-contain"
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          dragMomentum={false}
          style={{ touchAction: 'pan-y' }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 || info.velocity.x < -500) changeImage(1);
            else if (info.offset.x > 60 || info.velocity.x > 500) changeImage(-1);
          }}
        />

        {images.length > 1 && imageIndex > 0 && (
          <button
            type="button"
            aria-label="Previous image"
            onClick={event => {
              event.stopPropagation();
              changeImage(-1);
            }}
            className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-3xl leading-none text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span aria-hidden="true">{'‹'}</span>
          </button>
        )}

        {images.length > 1 && imageIndex < images.length - 1 && (
          <button
            type="button"
            aria-label="Next image"
            onClick={event => {
              event.stopPropagation();
              changeImage(1);
            }}
            className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-3xl leading-none text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span aria-hidden="true">{'›'}</span>
          </button>
        )}
      </motion.div>

      {images.length > 1 && (
        <div
          className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/35 px-3 py-2"
          onClick={event => event.stopPropagation()}
          aria-label={`Image ${imageIndex + 1} of ${images.length}`}
        >
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`Show image ${index + 1}`}
              aria-current={imageIndex === index ? 'true' : undefined}
              onClick={() => setImageIndex(index)}
              className={`size-2.5 rounded-full transition-colors ${
                imageIndex === index ? 'bg-white' : 'bg-white/45 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ImageLightbox;
