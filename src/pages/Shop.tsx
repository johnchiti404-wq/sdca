import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Star, ChevronRight } from 'lucide-react';
import { Store, StoreCategory, brandKeyOf } from '../data/storesData';
import { fetchStoresByCategory, isStoreOpen } from '../services/storeService';
import { haversineDistanceKm, estimateTravelTimeMinutes } from '../utils/geoUtils';
import { useGeolocation } from '../hooks/useGeolocation';

// Store enriched with live distance + travel-time relative to the user's location
interface StoreWithDistance extends Store {
  computedDistanceKm: number | null;
  computedTravelMinutes: number | null;
  branchCount?: number;
  branches?: StoreWithDistance[];
}

// Skeleton Card Component - Uber/Bolt style animated placeholder
const StoreSkeletonCard: React.FC<{ index: number }> = ({ index }) => (
  <motion.div
    className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    <div className="flex items-center space-x-4 p-4">
      {/* Store image placeholder */}
      <div className="w-20 h-20 rounded-2xl bg-gray-200 animate-pulse flex-shrink-0" />
      
      <div className="flex-1">
        {/* Store name */}
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
        
        {/* Distance and rating */}
        <div className="flex items-center space-x-4 mb-2">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Delivery time */}
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
      
      {/* Chevron placeholder */}
      <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
    </div>
  </motion.div>
);

export const Shop: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchSheet, setBranchSheet] = useState<{ brand: string; branches: StoreWithDistance[] } | null>(null);
  const { latitude, longitude } = useGeolocation();
  const userLocation = latitude != null && longitude != null
    ? { lat: latitude, lng: longitude }
    : null;
  
  // Get category from navigation state, default to 'food'
  const category: StoreCategory = (location.state?.category as StoreCategory) || 'food';

  // Fetch stores from Firestore
  useEffect(() => {
    const loadStores = async () => {
      setLoading(true);
      try {
        const fetchedStores = await fetchStoresByCategory(category);
        setStores(fetchedStores);
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStores();
  }, [category]);

  // Get page title based on category
  const getPageTitle = () => {
    switch (category) {
      case 'food':
        return 'Foodies';
      case 'clothes':
        return 'Clothes & Others';
      case 'hardware':
        return 'Hardware';
      case 'market':
        return 'Soweto Market';
      case 'small_shop':
        return 'Small Shops';
      default:
        return 'Aletwende Send';
    }
  };

  // Get category tag text
  const getCategoryTag = () => {
    switch (category) {
      case 'food':
        return 'Food Shops';
      case 'clothes':
        return 'Clothing Stores';
      case 'hardware':
        return 'Hardware Stores';
      case 'market':
        return 'Fresh Market Goods';
      case 'small_shop':
        return 'Everyday Essentials';
      default:
        return 'Shops';
    }
  };

  const filteredStores = useMemo<StoreWithDistance[]>(() => {
    // Filter by search query first
    const base = !searchQuery.trim()
      ? stores
      : stores.filter(store =>
          store.storeName.toLowerCase().includes(searchQuery.toLowerCase())
        );

    // Enrich each store with distance + travel-time relative to the user
    const enriched: StoreWithDistance[] = base.map(store => {
      if (
        userLocation &&
        typeof store.location?.lat === 'number' &&
        typeof store.location?.lng === 'number'
      ) {
        const distanceKm = haversineDistanceKm(
          userLocation.lat,
          userLocation.lng,
          store.location.lat,
          store.location.lng
        );
        return {
          ...store,
          computedDistanceKm: distanceKm,
          computedTravelMinutes: estimateTravelTimeMinutes(distanceKm)
        };
      }
      return { ...store, computedDistanceKm: null, computedTravelMinutes: null };
    });

    const sorted = enriched.sort((a, b) => {
      if (a.computedDistanceKm === null) return 1;
      if (b.computedDistanceKm === null) return -1;
      return a.computedDistanceKm - b.computedDistanceKm;
    });
    if (!userLocation) return sorted;
    const grouped = new Map<string, StoreWithDistance[]>();
    sorted.forEach(store => {
      const key = brandKeyOf(store.storeName);
      grouped.set(key, [...(grouped.get(key) || []), store]);
    });
    return Array.from(grouped.values()).map(branches => {
      const open = branches.find(branch => isStoreOpen(branch.openingHours).isOpen);
      return { ...(open || branches[0]), branchCount: branches.length, branches } as StoreWithDistance & { branchCount: number; branches: StoreWithDistance[] };
    });
  }, [searchQuery, stores, userLocation]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
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

  const handleStoreClick = (store: Store) => {
    // Check if store is open
    const { isOpen } = isStoreOpen(store.openingHours);
    if (!isOpen) {
      return; // Don't navigate if store is closed
    }

    // Navigate to the appropriate order page based on category
    let orderPath = '/order-foodies';
    if (category === 'clothes') {
      orderPath = '/order-clothes';
    } else if (category === 'hardware') {
      orderPath = '/order-hardware';
    } else if (category === 'market') {
      orderPath = '/order-soweto';
    } else if (category === 'small_shop') {
      orderPath = '/order-small-shops';
    }
    
    navigate(`${orderPath}/${store.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
        {/* Header skeleton */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-12 bg-gray-100 rounded-full animate-pulse" />
        </div>

        {/* Category tag skeleton */}
        <div className="px-4 py-4 flex justify-center">
          <div className="h-10 w-32 bg-gray-100 rounded-full animate-pulse" />
        </div>

        {/* Store list skeleton */}
        <div className="px-4 pb-24 space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <StoreSkeletonCard key={index} index={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <div className="flex items-center space-x-4 mb-4">
          <motion.button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </motion.button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{getPageTitle()}</h1>
        </div>

        {/* Search Box */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-800 rounded-full pl-12 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B2EFF] transition-all"
          />
        </motion.div>
      </motion.div>

      {/* Category Tag */}
      <motion.div
        className="px-4 py-4 flex justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="inline-block bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-[#5B2EFF] rounded-full px-6 py-2">
          <span className="font-semibold text-[#5B2EFF]">{getCategoryTag()}</span>
        </div>
      </motion.div>

      {/* Stores List */}
      <div className="px-4 pb-24">
        {filteredStores.length > 0 ? (
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredStores.map((store) => {
              const { isOpen, nextOpenTime } = isStoreOpen(store.openingHours);
              const branches = store.branches || [store];
              
              return (
                <div key={store.id}>
                <motion.button
                  key={store.id}
                  onClick={() => handleStoreClick(store)}
                  className={`w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 transition-all overflow-hidden ${
                    isOpen 
                      ? 'hover:border-purple-300 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  variants={itemVariants}
                  whileTap={isOpen ? { scale: 0.98 } : {}}
                  whileHover={isOpen ? { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' } : {}}
                  disabled={!isOpen}
                >
                  <div className="flex items-center space-x-4 p-4">
                    {/* Store Image */}
                    <div className="w-20 h-20 rounded-2xl bg-gray-200 overflow-hidden flex-shrink-0 relative">
                      {store.logo ? (
                        <img
                          src={store.logo}
                          alt={store.storeName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                          <span className="text-2xl">🏪</span>
                        </div>
                      )}
                      {/* Open/Closed Badge */}
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isOpen 
                          ? 'bg-[#5B2EFF] text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </div>
                    </div>

                    {/* Store Info */}
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{brandKeyOf(store.storeName).replace(/\b\w/g, letter => letter.toUpperCase())}</h3>
                      {store.branchCount && store.branchCount > 1 && <p className="text-xs text-gray-500 mb-1">{store.branchCount} branches · nearest {store.computedDistanceKm?.toFixed(1) ?? '--'} km</p>}

                      {/* Distance and Rating */}
                      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <div className="flex items-center space-x-1">
                          <span>📍</span>
                          <span>
                            {store.computedDistanceKm !== null
                              ? `${store.computedDistanceKm.toFixed(1)} km away`
                              : 'Distance unavailable'}
                          </span>
                        </div>
                        {store.rating && (
                          <div className="flex items-center space-x-1">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            <span>{store.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      {/* Travel Time or Closed Status */}
                      {isOpen ? (
                        <p className="text-sm text-gray-600">
                          {store.computedTravelMinutes !== null
                            ? `${store.computedTravelMinutes} min`
                            : (store.delivery_time || '-- min')}
                        </p>
                      ) : (
                        <p className="text-sm text-red-600">
                          {nextOpenTime ? `Opens ${nextOpenTime}` : 'Currently closed'}
                        </p>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="text-gray-400">
                      <ChevronRight size={24} />
                    </div>
                  </div>
                </motion.button>
                {branches.length > 1 && userLocation && (
                  <button type="button" onClick={() => setBranchSheet({ brand: brandKeyOf(store.storeName), branches })} className="mt-1 w-full text-left px-4 text-xs font-semibold text-[#5B2EFF]">Choose another branch</button>
                )}
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            className="flex flex-col items-center justify-center py-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No stores found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try searching for a different store</p>
          </motion.div>
        )}
      </div>
      {branchSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setBranchSheet(null)}>
          <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{branchSheet.brand}</h2><button type="button" onClick={() => setBranchSheet(null)} aria-label="Close">×</button></div>
            <div className="space-y-2">{branchSheet.branches.map(branch => { const status = isStoreOpen(branch.openingHours); return <button type="button" key={branch.id} disabled={!status.isOpen} onClick={() => handleStoreClick(branch)} className="w-full rounded-xl border p-3 text-left disabled:opacity-50"><div className="flex justify-between gap-3"><span className="font-semibold">{branch.storeName}</span><span className={status.isOpen ? 'text-green-600' : 'text-red-500'}>{status.isOpen ? 'OPEN' : 'CLOSED'}</span></div><p className="text-xs text-gray-500">{branch.address} · {branch.computedDistanceKm?.toFixed(1) ?? '--'} km</p></button>; })}</div>
          </div>
        </div>
      )}
    </div>
  );
};
