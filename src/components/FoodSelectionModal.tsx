import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useFoodOrderSession } from '../contexts/FoodOrderSession';

interface FoodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  stopId: string;
  mode: 'current-location' | 'stop';
}

export const FoodSelectionModal: React.FC<FoodSelectionModalProps> = ({
  isOpen,
  onClose,
  title,
  stopId,
  mode,
}) => {
  const { cartItems, currentLocationFoodIds, updateStop, stops } = useFoodOrderSession();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      if (mode === 'current-location') {
        setSelectedIds(new Set(currentLocationFoodIds));
      } else {
        const stop = stops.find(s => s.id === stopId);
        setSelectedIds(new Set(stop?.foodIds || []));
      }
    }
  }, [isOpen, mode, stopId, currentLocationFoodIds, stops]);

  const toggleItem = (itemId: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(itemId)) {
      if (mode === 'current-location' && selectedIds.size === 1) {
        return;
      }
      newSelectedIds.delete(itemId);
    } else {
      newSelectedIds.add(itemId);
    }
    setSelectedIds(newSelectedIds);
  };

  const handleConfirm = () => {
    if (mode === 'stop') {
      updateStop(stopId, { foodIds: Array.from(selectedIds) });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto will-change-transform"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose();
              }
            }}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <motion.button
                onClick={onClose}
                className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                <X size={20} className="text-gray-600 dark:text-gray-300" />
              </motion.button>
            </div>

            <div className="px-6 py-4 space-y-3 pb-24">
              {cartItems.map((item, index) => {
                const isSelected = selectedIds.has(item.id);

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center space-x-4 ${
                      isSelected
                        ? 'border-[#5B2EFF] bg-[#f3f0ff] dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-gray-900 dark:text-white">{item.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">K{item.price}</p>
                    </div>

                    {isSelected && (
                      <motion.div
                        className="w-6 h-6 bg-[#5B2EFF] rounded-full flex items-center justify-center flex-shrink-0"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      >
                        <span className="text-white text-sm">✓</span>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-6"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.button
                onClick={handleConfirm}
                className="w-full bg-[#5B2EFF] text-white font-bold py-4 rounded-2xl hover:bg-[#4a25cc] transition-colors"
                whileTap={{ scale: 0.98 }}
              >
                OK
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
