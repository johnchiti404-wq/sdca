import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { safeJson } from '../config/api';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: 'direct_trip' | 'store_delivery';
  driverName: string;
  driverPhoto: string;
  driverId: string;
  orderId: string;
  // Only needed for store_delivery path
  storeName?: string;
  storeImage?: string;
  storeId?: string;
  onSubmitted?: () => void | Promise<void>;
  canClose?: boolean;
}

const RATING_EMOJIS: Record<number, string> = {
  1: '😢',
  2: '😕',
  3: '😐',
  4: '😊',
  5: '🤩',
};

export const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  path,
  driverName,
  driverPhoto,
  driverId,
  orderId,
  storeName,
  storeImage,
  storeId,
  onSubmitted,
  canClose = false,
}) => {
  // State for current step (1 = driver, 2 = store for store_delivery)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Store driver rating for store_delivery path (submitted after store rating)
  const [driverRating, setDriverRating] = useState<{ rating: number; feedback: string } | null>(null);
  
  // Animation key for emoji
  const [emojiKey, setEmojiKey] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setRating(0);
      setHoveredRating(0);
      setFeedback('');
      setIsSubmitting(false);
      setError(null);
      setDriverRating(null);
      setEmojiKey(0);
    }
  }, [isOpen]);

  // Animate emoji when rating changes
  useEffect(() => {
    if (rating > 0) {
      setEmojiKey(prev => prev + 1);
    }
  }, [rating]);

  const currentName = currentStep === 1 ? driverName : (storeName || 'Store');
  const currentPhoto = currentStep === 1 ? driverPhoto : storeImage;
  const currentEmoji = rating > 0 ? RATING_EMOJIS[rating] : null;

  const submitDriverRating = async (driverRatingValue: number, driverFeedback: string) => {
    const response = await fetch('https://aletwend-render-backend.onrender.com/api/ratings/driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId,
        orderId,
        rating: driverRatingValue,
        feedback: driverFeedback || '',
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to submit driver rating');
    }
    return safeJson(response);
  };

  const submitStoreRating = async (storeRatingValue: number, storeFeedback: string) => {
    const response = await fetch('https://aletwend-render-backend.onrender.com/api/ratings/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        orderId,
        rating: storeRatingValue,
        feedback: storeFeedback || '',
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to submit store rating');
    }
    return safeJson(response);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (path === 'direct_trip') {
        // Direct trip: submit driver rating and close
        await submitDriverRating(rating, feedback);
        await onSubmitted?.();
        onClose();
      } else {
        // Store delivery path
        if (currentStep === 1) {
          // Step 1: Store driver rating locally and transition to step 2
          setDriverRating({ rating, feedback });
          setCurrentStep(2);
          setRating(0);
          setHoveredRating(0);
          setFeedback('');
          setIsSubmitting(false);
        } else {
          // Step 2: Submit both ratings in parallel
          if (!driverRating) {
            setError('Driver rating missing');
            setIsSubmitting(false);
            return;
          }

          await Promise.all([
            submitDriverRating(driverRating.rating, driverRating.feedback),
            submitStoreRating(rating, feedback),
          ]);
          await onSubmitted?.();
          onClose();
        }
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError('Something went wrong, please try again');
      setIsSubmitting(false);
    }
  };

  const getStepText = () => {
    if (currentStep === 1) {
      return 'Step 1 of 2 — Rate your driver';
    }
    return 'Step 2 of 2 — Rate the store';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full relative overflow-hidden"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Step Indicator for store_delivery path */}
              {canClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Close rating"
                >
                  <X size={20} />
                </button>
              )}
              {path === 'store_delivery' && (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-4"
                >
                  <span className="text-sm font-medium text-[#5B2EFF]">
                    {getStepText()}
                  </span>
                </motion.div>
              )}

              <div className="text-center mb-6">
                {/* Profile Image with animation on step change */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`photo-${currentStep}`}
                    className="w-28 h-28 rounded-full mx-auto mb-4 overflow-hidden shadow-lg"
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 10 }}
                    transition={{ type: 'spring', damping: 15 }}
                  >
                    {currentPhoto ? (
                      <img 
                        src={currentPhoto} 
                        alt={currentName} 
                        className="w-28 h-28 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-28 h-28 bg-gradient-to-br from-[#7B5EFF] to-[#5B2EFF] rounded-full flex items-center justify-center text-5xl text-white">
                        {currentName?.charAt(0) || '?'}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Name with animation on step change */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`name-${currentStep}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                  >
                    {currentName}
                  </motion.p>
                </AnimatePresence>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {currentStep === 1 ? 'Rate your driver' : 'Rate the store'}
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  {currentStep === 1 
                    ? `How was your experience with ${currentName}?`
                    : `How was your experience with ${currentName}?`
                  }
                </p>
              </div>

              {/* Emoji Reaction */}
              <div className="flex justify-center mb-4 h-12">
                <AnimatePresence mode="wait">
                  {currentEmoji && (
                    <motion.span
                      key={`emoji-${emojiKey}`}
                      className="text-5xl"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                    >
                      {currentEmoji}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center space-x-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="focus:outline-none"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Star
                      size={40}
                      className={`transition-colors ${
                        star <= (hoveredRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  </motion.button>
                ))}
              </div>

              {/* Feedback Textarea */}
              {rating > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Share your experience (optional)"
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] resize-none"
                    rows={4}
                  />
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-sm text-center mb-4"
                >
                  {error}
                </motion.p>
              )}

              {/* Submit Button */}
              <div className="space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={rating === 0 || isSubmitting}
                  className={`w-full py-4 rounded-2xl font-semibold text-lg transition-colors ${
                    rating === 0 || isSubmitting
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-[#5B2EFF] text-white hover:bg-[#4922cc]'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit rating'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
