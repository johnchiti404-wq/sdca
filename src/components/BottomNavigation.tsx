 import React from 'react';
import { Home, Calendar, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useActiveOrder } from '../hooks/useActiveOrder';

interface BottomNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  activeTab = 'home',
  onTabChange 
}) => {
  const navigate = useNavigate();
  const { order: activeOrder } = useActiveOrder();

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rides', label: 'Rides', icon: Calendar },
    { id: 'account', label: 'Account', icon: User }
  ];

  const handleTabClick = (tabId: string) => {
    if (activeOrder) return;
    onTabChange?.(tabId);
    
    if (tabId === 'home') {
      navigate('/');
    } else if (tabId === 'rides') {
      navigate('/rides');
    } else if (tabId === 'account') {
      navigate('/account');
    }
  };

  return (
    <motion.div 
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 py-2 z-30"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.3 }}
    >
      <div className="flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                isActive ? 'text-[#5B2EFF]' : 'text-gray-500 dark:text-gray-400'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <Icon size={24} className={isActive ? 'text-[#5B2EFF]' : 'text-gray-500 dark:text-gray-400'} />
              <span className={`text-xs mt-1 ${isActive ? 'text-[#5B2EFF] font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};