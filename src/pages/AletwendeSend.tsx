import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export const AletwendeSend: React.FC = () => {
  const navigate = useNavigate();

  const categories = [
    {
      id: 'package',
      label: 'Send My Package',
      icon: '📦',
      color: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
      description: 'Safe package delivery'
    },
    {
      id: 'foodies',
      label: 'Foodies',
      icon: '🍔',
      color: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 hover:border-pink-300 dark:hover:border-pink-700',
      description: 'Food delivery'
    },
    {
      id: 'delivery-truck',
      label: 'Delivery Truck',
      icon: '🚚',
      color: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 hover:border-cyan-300 dark:hover:border-cyan-700',
      description: 'Bulk delivery'
    },
      {
      id: 'clothes',
      label: 'Clothes & Others',
      icon: '👕',
      color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700',
      description: 'Shopping delivery'
    },
    {
      id: 'towing',
      label: 'Towing',
      icon: '🚗',
      color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700',
      description: 'Vehicle towing'
    },
     
    {
      id: 'hardware',
      label: 'Hardware',
      icon: '🏗️',
      color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700',
      description: 'Building materials'
    },
    {
      id: 'soweto-market',
      label: 'Soweto Market',
      icon: '🛒',
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700',
      description: 'Fresh market goods'
    },
    {
      id: 'small-shops',
      label: 'Small Shops',
      icon: '🏪',
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700',
      description: 'Groceries and everyday items'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', damping: 12, stiffness: 100 }
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === 'foodies') {
      navigate('/shop', { state: { category: 'food' } });
    } else if (categoryId === 'clothes') {
      navigate('/shop', { state: { category: 'clothes' } });
    } else if (categoryId === 'hardware') {
      navigate('/shop', { state: { category: 'hardware' } });
    } else if (categoryId === 'soweto-market') {
      navigate('/shop', { state: { category: 'market' } });
    } else if (categoryId === 'small-shops') {
      navigate('/shop', { state: { category: 'small_shop' } });
    } else if (categoryId === 'package') {
      navigate('/your-route', { state: { serviceType: 'package' } });
    } else if (categoryId === 'towing') {
      navigate('/your-route', { state: { serviceType: 'towing' } });
    } else if (categoryId === 'delivery-truck') {
      navigate('/your-route', { state: { serviceType: 'truck' } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <div className="flex items-center space-x-4">
          <motion.button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </motion.button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Aletwende Send</h1>
        </div>
      </motion.div>

      {/* Content */}
      <div className="px-4 py-8 pb-24">
        {/* Heading */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 300 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">
            Lets burn some energy with Aletwende🔥💪
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Choose a category to get started</p>
        </motion.div>

        {/* Categories Grid */}
        <motion.div
          className="grid grid-cols-2 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {categories.map((category, index) => (
            <motion.button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`p-6 rounded-3xl border-2 transition-all ${category.color} active:scale-95`}
              variants={itemVariants}
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -4 }}
              transition={{ delay: index * 0.05, type: 'spring', damping: 12, stiffness: 100 }}
            >
              <div className="text-5xl mb-3">{category.icon}</div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                {category.label}
              </h3>
              <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                {category.description}
              </p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
