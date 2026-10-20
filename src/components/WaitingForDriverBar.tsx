import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';

export const WaitingForDriverBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/waiting-for-driver') {
    return null;
  }

  return (
    <motion.div
      className="fixed top-4 right-4 z-40 bg-amber-500 rounded-2xl shadow-2xl p-3 cursor-pointer hover:shadow-3xl transition-shadow"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      onClick={() => navigate('/waiting-for-driver')}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center space-x-3 min-w-[200px]">
        <div className="w-10 h-10 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
          <Clock size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white uppercase tracking-wide">Waiting for Driver</p>
          <p className="text-sm font-bold text-white">Finding your ride...</p>
        </div>
      </div>
    </motion.div>
  );
};
