import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapBackground } from '../components/MapBackground';

export const ScheduleConfirm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pickup, destination, stops } = location.state || {};

  return (
    <motion.div 
      className="min-h-screen relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MapBackground />
      
      {/* Header */}
      <motion.div 
        className="absolute top-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 shadow-sm p-4"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-800 dark:text-white" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{destination}</h2>
          <button className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <Plus size={20} className="text-gray-800 dark:text-white" />
          </button>
        </div>
      </motion.div>

      {/* Bottom Panel */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-6 z-20"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        <div className="space-y-6">
          {/* Close button */}
          <div className="flex justify-end">
            <button 
              onClick={() => navigate('/')}
              className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={16} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose payment method</h2>
            <p className="text-gray-600 dark:text-gray-300">Set your payment method before requesting a ride.</p>
          </div>

          {/* Add Card Button */}
          <motion.button
            onClick={() => {
              // Handle payment method selection
              console.log('Add card clicked');
            }}
            className="w-full bg-[#5B2EFF] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#4a25cc] transition-colors shadow-lg"
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.02 }}
          >
            Add card
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};
