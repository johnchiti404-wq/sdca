import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

interface CrossStoreModalProps {
  open: boolean;
  currentStoreName: string;
  attemptedStoreName: string;
  onClearCart: () => void;
  onCancel: () => void;
  // Accent color for the primary "Clear cart" button (matches each category page)
  accentClassName?: string;
}

// Modal shown when a user tries to add an item from a different store than the
// one already in the cart. Only items from a single store are allowed at a time.
export const CrossStoreModal: React.FC<CrossStoreModalProps> = ({
  open,
  currentStoreName,
  attemptedStoreName,
  onClearCart,
  onCancel,
  accentClassName = 'bg-[#5B2EFF] hover:bg-[#4a25cc]',
}) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 24, stiffness: 250 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <ShoppingCart className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Start a new cart?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {`You have items from ${currentStoreName} in your cart. Empty your cart to add items from ${attemptedStoreName}.`}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onClearCart}
                className={`w-full py-3 rounded-xl font-semibold text-white transition-colors ${accentClassName}`}
              >
                Clear cart
              </button>
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CrossStoreModal;
