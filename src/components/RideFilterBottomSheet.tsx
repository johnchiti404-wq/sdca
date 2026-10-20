import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, PanInfo } from 'framer-motion';
import { Users } from 'lucide-react';

interface Car {
  id: string;
  name: string;
  icon: string;
  eta: string;
  description: string;
  capacity: number;
  price: number;
  originalPrice?: number;
  badge?: string;
}

interface RideFilterBottomSheetProps {
  cars: Car[];
  selectedCar: Car;
  onSelectCar: (car: Car) => void;
  promo: {
    discount: number;
    ridesLeft: number;
    maxPerRide: number;
    expiryDate: string;
    paymentMethods: string;
  };
  onPromoClick: () => void;
}

type FilterType = 'recommended' | 'faster' | 'cheaper';

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 650;

export const RideFilterBottomSheet: React.FC<RideFilterBottomSheetProps> = ({
  cars,
  selectedCar,
  onSelectCar,
  promo,
  onPromoClick
}) => {
  const [filter, setFilter] = useState<FilterType>('recommended');

  const rawHeight = useMotionValue(400);
  const springHeight = useSpring(rawHeight, {
    stiffness: 300,
    damping: 35,
    mass: 0.8,
  });

  const backgroundOpacity = useTransform(springHeight, [MIN_HEIGHT, MAX_HEIGHT], [0.05, 0.25]);

  const getSortedCars = (): Car[] => {
    const sorted = [...cars];
    if (filter === 'cheaper') {
      return sorted.sort((a, b) => a.price - b.price);
    } else if (filter === 'faster') {
      return sorted.sort((a, b) => {
        const aMinutes = parseInt(a.eta) || 0;
        const bMinutes = parseInt(b.eta) || 0;
        return aMinutes - bMinutes;
      });
    }
    return sorted;
  };

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const newHeight = rawHeight.get() - info.delta.y;
    const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
    rawHeight.set(clamped);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const velocity = info.velocity.y;
    const currentHeight = rawHeight.get();

    if (Math.abs(velocity) > 600) {
      rawHeight.set(velocity < 0 ? MAX_HEIGHT : MIN_HEIGHT);
    } else {
      // Stay where released
      rawHeight.set(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, currentHeight)));
    }
  };

  const sortedCars = getSortedCars();

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black pointer-events-none z-10"
        style={{ opacity: backgroundOpacity }}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-20 will-change-transform"
        style={{ height: springHeight }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 260, mass: 0.6 }}
      >
        <motion.div
          className="w-full h-8 flex justify-center items-center cursor-grab active:cursor-grabbing touch-none"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileTap={{ scale: 1.02 }}
        >
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </motion.div>

        <div className="px-4 pb-4 overflow-hidden" style={{ height: 'calc(100% - 32px)' }}>
          <div className="space-y-4">
            {/* Promo Banner */}
            <motion.button
              onClick={onPromoClick}
              className="w-full bg-gradient-to-r from-[#5B2EFF] to-[#4a25cc] text-white rounded-2xl p-3 shadow-lg hover:shadow-xl transition-shadow"
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-semibold">&#x2713; {promo.discount}% promo applied</span>
                </div>
                <span className="text-sm opacity-90">i</span>
              </div>
            </motion.button>

            {/* Filter Buttons */}
            <div className="flex items-center space-x-2">
              {(['recommended', 'faster', 'cheaper'] as FilterType[]).map((filterType) => (
                <motion.button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-4 py-2 rounded-full font-medium transition-all border-2 ${
                    filter === filterType
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </motion.button>
              ))}
            </div>

            {/* Car Selection */}
            <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100% - 140px)' }}>
              {sortedCars.map((car, index) => (
                <motion.button
                  key={car.id}
                  onClick={() => onSelectCar(car)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    selectedCar.id === car.id
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">{car.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 dark:text-white">{car.name}</h3>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-white">K {car.price}</p>
                          {car.originalPrice && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-through">K {car.originalPrice}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-600 dark:text-gray-300">{car.eta}</span>
                        <div className="flex items-center space-x-1">
                          <Users size={14} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{car.capacity}</span>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{car.description}</span>
                      </div>
                      {car.badge && (
                        <span
                          className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-bold ${
                            car.badge === 'FASTER'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : car.badge === 'CHEAPER'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          }`}
                        >
                          {car.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};
