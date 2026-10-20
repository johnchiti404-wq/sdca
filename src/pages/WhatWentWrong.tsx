import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';

export const WhatWentWrong: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { rideId, userId, userName } = location.state || {};
  
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cancellationReasons = [
    'Long pickup time',
    'Car not moving towards me',
    'Accidental request',
    'Driver asked to pay off-the-app',
    'Driver not at pickup point',
    'Driver asked to cancel',
    'Driver asked for personal info',
    'Other'
  ];

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
  };

  const handleDone = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);

    try {
      let realRideId = rideId;

      // If rideId not provided, try to find it by userId
      if (!realRideId && userId) {
        realRideId = await firebaseService.findActiveRideByUser(userId);
      }

      if (!realRideId) {
        console.error('No valid rideId found to attach cancellation reason to.');
        // Optionally save the reason to a fallback log, but do not create 'unknown-ride'
        navigate('/', { replace: true });
        return;
      }

      // Ensure ride status is cancelled (idempotent)
      await firebaseService.updateRideStatus(realRideId, 'cancelled');

      // Save the cancellation reason under /cancellations/{rideId}
      await firebaseService.saveCancellationReason(realRideId, selectedReason, userId || 'user123', userName || 'Unknown User');

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to save cancellation reason:', error);
      navigate('/', { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-white dark:bg-gray-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="p-4 pt-12"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate('/', { replace: true })}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-800 dark:text-gray-200" />
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div 
        className="px-4 pb-32"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">What went wrong?</h1>

        {/* Scrollable reasons list */}
        <div className="space-y-0 max-h-96 overflow-y-auto">
          {cancellationReasons.map((reason, index) => (
            <motion.button
              key={reason}
              onClick={() => handleReasonSelect(reason)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-lg text-gray-900 dark:text-white text-left">{reason}</span>
              <div className="flex items-center space-x-3">
                {reason === 'Other' && <ChevronRight size={20} className="text-gray-400" />}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedReason === reason 
                    ? 'border-[#5B2EFF] bg-[#5B2EFF]' 
                    : 'border-gray-300'
                }`}>
                  {selectedReason === reason && (
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Fixed Done Button */}
      <motion.div 
        className="fixed bottom-6 left-4 right-4"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          onClick={handleDone}
          disabled={!selectedReason || isSubmitting}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-colors ${
            selectedReason && !isSubmitting
              ? 'bg-[#5B2EFF] text-white hover:bg-[#4a25cc]' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Saving...' : 'Done'}
        </button>
      </motion.div>
    </motion.div>
  );
};