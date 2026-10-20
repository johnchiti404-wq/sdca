import React from 'react';
import { motion } from 'framer-motion';

interface DeliveryMode {
  id: 'motorbike' | 'car' | 'bicycle';
  label: string;
  time: string;
  description: string;
  deliveryFee: number;
  icon: string;
}

interface DeliveryCardProps {
  mode: DeliveryMode;
  subtotal: number;
  totalItemCount: number;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

export function DeliveryCard({
  mode,
  subtotal,
  totalItemCount,
  isSelected,
  onSelect,
  index
}: DeliveryCardProps) {
  // Each card calculates its own total independently
  const cardTotal = subtotal + mode.deliveryFee;

  return (
    <motion.button
      onClick={onSelect}
      className={`w-full p-4 rounded-2xl transition-all border-2 ${
        isSelected
          ? 'bg-[#F3EEFF] dark:bg-purple-900/20 border-[#5B2EFF]'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 flex-shrink-0 text-3xl flex items-center justify-center">
          {mode.icon}
        </div>

        <div className="flex-1 text-left">
          <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">{mode.label}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span>{mode.time}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="font-bold text-gray-900 dark:text-white text-lg">
            R {cardTotal}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            R {mode.deliveryFee}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
