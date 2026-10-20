import React from 'react';
import { motion } from 'framer-motion';

export const MapBackground: React.FC = () => {
  return (
    <motion.div 
      className="fixed inset-0 bg-gradient-to-br from-purple-100 via-purple-50 to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 z-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Grid pattern to simulate map */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Simulated streets */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-0 right-0 h-2 bg-gray-400 dark:bg-gray-600 transform rotate-12"></div>
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-300 dark:bg-gray-700 transform -rotate-6"></div>
        <div className="absolute top-3/4 left-0 right-0 h-2 bg-gray-400 dark:bg-gray-600 transform rotate-3"></div>
        <div className="absolute top-0 bottom-0 left-1/4 w-1 bg-gray-300 dark:bg-gray-700 transform rotate-2"></div>
        <div className="absolute top-0 bottom-0 left-2/3 w-2 bg-gray-400 dark:bg-gray-600 transform -rotate-1"></div>
      </div>

      {/* Location markers */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-4 h-4 bg-[#5B2EFF] rounded-full animate-pulse"></div>
      </div>
      <div className="absolute top-2/3 right-1/3 transform translate-x-1/2 -translate-y-1/2">
        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
      </div>
    </motion.div>
  );
};
