import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar } from 'lucide-react';

interface AnimatedSearchHeaderProps {
  panelHeight: number;
  maxHeight: number;
  minHeight: number;
  onWhereToClick: () => void;
  onScheduleClick: () => void;
}

export const AnimatedSearchHeader: React.FC<AnimatedSearchHeaderProps> = ({
  panelHeight,
  maxHeight,
  minHeight,
  onWhereToClick,
  onScheduleClick
}) => {
  const heightRange = maxHeight - minHeight;
  const normalizedHeight = (panelHeight - minHeight) / heightRange;
  const isCompressed = normalizedHeight < 0.5;

  return (
    <motion.div
      className={`relative transition-all duration-300 ${
        isCompressed ? 'fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 shadow-md' : ''
      }`}
      style={{
        opacity: normalizedHeight > 0.3 ? 1 : 0.5,
        y: isCompressed ? 0 : undefined
      }}
    >
      <motion.div
        className="space-y-4 px-4 py-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <button
              onClick={onWhereToClick}
              className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl pl-12 pr-4 py-4 text-left text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Where to?
            </button>
          </div>
          <button
            onClick={onScheduleClick}
            className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="text-gray-600 dark:text-gray-300" size={20} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
