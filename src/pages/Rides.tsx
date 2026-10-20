 import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '../components/BottomNavigation';

export const Rides: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [hasScheduledRides] = useState(false); // This would come from your data store

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <motion.div 
        className="bg-white dark:bg-gray-900 p-4 pt-12"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Rides</h1>
          <button className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Info size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div 
        className="bg-white dark:bg-gray-900 px-4 pb-4"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'upcoming' 
                ? 'border-purple-500 text-purple-600 font-semibold' 
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'past' 
                ? 'border-purple-500 text-purple-600 font-semibold' 
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            Past
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div 
        className="flex-1 flex flex-col items-center justify-center px-4 py-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Calendar Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
            <Calendar size={48} className="text-gray-400" />
          </div>
          <div className="absolute -top-2 -right-2 w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
          </div>
        </div>

        {/* No rides message */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
          No {activeTab} rides
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-sm">
          {activeTab === 'upcoming' 
            ? "Whatever is on your schedule, a Scheduled Ride can get you there on time"
            : "Your past rides will appear here"
          }
        </p>

        {activeTab === 'upcoming' && (
          <button 
            onClick={() => navigate('/schedule-ride')}
            className="text-purple-600 font-semibold hover:text-purple-700 transition-colors"
          >
            Learn how it works
          </button>
        )}
      </motion.div>

      {/* Schedule Ride Button - Only show when no scheduled rides */}
      {!hasScheduledRides && activeTab === 'upcoming' && (
        <motion.div 
          className="fixed bottom-20 left-4 right-4 z-20"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={() => navigate('/schedule-ride')}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-purple-700 transition-colors shadow-lg"
          >
            Schedule a ride
          </button>
        </motion.div>
      )}

      <BottomNavigation activeTab="rides" />
    </div>
  );
};