import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, Clock, Loader2 } from 'lucide-react';
import { DraggablePanel } from '../components/DraggablePanel';
import { ScrollableSection } from '../components/ScrollableSection';
import { BottomNavigation } from '../components/BottomNavigation';
import { MapLibreMap } from '../components/MapLibreMap';
import { getRecentAddresses, reverseGeocode, GeoapifyAddress, RECENT_ADDRESSES_UPDATED_EVENT } from '../services/geoapifyService';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNearbyDrivers, LUSAKA_DEFAULT } from '../hooks/useNearbyDrivers';
import { useActiveOrder } from '../hooks/useActiveOrder';
import { useRootBackLock } from '../hooks/useRootBackLock';

interface DashboardProps {
  onSearchSelect: (address: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSearchSelect }) => {
  useRootBackLock();
  const navigate = useNavigate();
  const [panelHeight, setPanelHeight] = useState(450);
  const { order: activeOrder } = useActiveOrder();
  const isRideActive = Boolean(activeOrder);
  const { latitude, longitude, loading: locationLoading, error: locationError } = useGeolocation();
  const [recentAddresses, setRecentAddresses] = useState<GeoapifyAddress[]>([]);
  const [isLoadingRecentAddress, setIsLoadingRecentAddress] = useState(false);
  const nearbyDrivers = useNearbyDrivers(latitude, longitude);

  const maxPanelHeight = 600;
  const minPanelHeight = 175;

  // Load real recent addresses from localStorage (saved via Geoapify).
  // Uses the same key/source as YourRoute via getRecentAddresses().
  useEffect(() => {
    setRecentAddresses(getRecentAddresses());
  }, []);

  // Keep the dashboard's recent addresses in sync if they are saved from
  // another page during the same session.
  useEffect(() => {
    const handleStorage = () => setRecentAddresses(getRecentAddresses());
    window.addEventListener('storage', handleStorage);
    window.addEventListener(RECENT_ADDRESSES_UPDATED_EVENT, handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(RECENT_ADDRESSES_UPDATED_EVENT, handleStorage);
    };
  }, []);

  const handleRidesClick = () => {
    if (isRideActive) return;
    navigate('/your-route');
  };

  const handleWhereToClick = () => {
    if (isRideActive) return;
    navigate('/your-route');
  };

  // Handle recent address click - get current location and navigate to SelectRide
  const handleRecentAddressClick = useCallback(async (recentAddress: GeoapifyAddress) => {
    if (isRideActive) return;

    // Show loading state
    setIsLoadingRecentAddress(true);

    try {
      // Get user's current location as pickup
      if (!latitude || !longitude) {
        const errorMsg = locationLoading
          ? 'Getting your location, please wait...'
          : locationError
            ? `Location error: ${locationError}`
            : 'Unable to get your current location. Please enable location services and refresh the page.';
        alert(errorMsg);
        setIsLoadingRecentAddress(false);
        return;
      }

      // Reverse geocode to get pickup address
      const pickupResult = await reverseGeocode(latitude, longitude);

      if (!pickupResult) {
        alert('Unable to get your current address. Please try again.');
        setIsLoadingRecentAddress(false);
        return;
      }

      // Navigate to SelectRide with current location as pickup and recent address as destination
      navigate('/select-ride', {
        state: {
          serviceType: 'ride',
          pickup: pickupResult.address,
          destination: recentAddress.address,
          stops: [],
          pickupCoords: {
            lat: latitude,
            lng: longitude
          },
          destinationCoords: recentAddress.coords,
          stopCoords: [],
          fromDashboard: true
        }
      });
    } catch (error) {
      console.error('Error handling recent address click:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsLoadingRecentAddress(false);
    }
  }, [latitude, longitude, locationLoading, locationError, isRideActive, navigate]);

  const handleAletwendeClick = () => {
    if (isRideActive) return;
    navigate('/aletwende-send');
  };

  const serviceButtons = [
    { id: 'rides', label: 'Rides', description: "Let's get moving", icon: '🚗', action: handleRidesClick },
    { id: 'schedule', label: 'Schedule', description: 'Book ahead', icon: '📅' },
    { id: 'aletwende', label: 'Aletwende Send', description: 'Package delivery', icon: '📦', action: handleAletwendeClick }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Real MapLibre Map Background */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
  center={latitude && longitude ? { lat: latitude, lng: longitude } : LUSAKA_DEFAULT}
  zoom={13}
  markers={[
    ...(latitude != null && longitude != null ? [{ id: 'current-location', type: 'currentLocation' as const, lat: latitude, lng: longitude }] : []),
    ...nearbyDrivers
  ]}
  fitBounds={false}
          className="w-full h-full"
        />
      </div>
      
      <DraggablePanel
        initialHeight={450}
        maxHeight={maxPanelHeight}
        minHeight={minPanelHeight}
        onHeightChange={setPanelHeight}
      >
        <div className="relative">
          {/* Let's go places header - stays in place */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2 mb-3">
            Let's go places.
          </h1>

          {/* Service buttons - stays in place */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {serviceButtons.map((service, index) => (
              <motion.button
                key={service.id}
                onClick={() => {
                  if (isRideActive) return;
                  if (service.action) {
                    service.action();
                  } else if (service.id === 'schedule') {
                    navigate('/schedule-ride');
                  }
                }}
                disabled={isRideActive}
                className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3 text-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <div className="text-2xl mb-1">{service.icon}</div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{service.label}</h3>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{service.description}</p>
              </motion.button>
            ))}
          </div>

          {/* Search box - stays in place */}
          <div className="relative z-10">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <button
                  onClick={handleWhereToClick}
                  disabled={isRideActive}
                  className="w-full pl-12 pr-4 py-3 text-left text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors bg-transparent"
                >
                  Where to?
                </button>
              </div>
              {/* Schedule button inside search box */}
              <button
                onClick={() => !isRideActive && navigate('/schedule-ride')}
                disabled={isRideActive}
                className="px-4 py-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-l border-gray-200 dark:border-gray-700"
              >
                <Calendar className="text-gray-600 dark:text-gray-300" size={20} />
              </button>
            </div>
          </div>

          {/* Recent searches - real addresses from Geoapify history */}
          <div className="mt-2">
            {/* Loading overlay for recent address navigation */}
            {isLoadingRecentAddress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
              >
                <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-[#5B2EFF] animate-spin" />
                  <p className="text-gray-700 font-medium">Getting your location...</p>
                </div>
              </motion.div>
            )}
            <ScrollableSection maxHeight="max-h-40">
              <div className="space-y-2">
                {recentAddresses.length > 0 ? (
                  recentAddresses.map((search, index) => (
                    <motion.button
                      key={search.id}
                      onClick={() => handleRecentAddressClick(search)}
                      disabled={isLoadingRecentAddress || isRideActive}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left disabled:opacity-50"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Clock className="text-gray-400 flex-shrink-0" size={20} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{search.address}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{search.description}</p>
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-center py-4 text-gray-500 dark:text-gray-400"
                  >
                    <p className="text-sm">No recent addresses yet</p>
                    <p className="text-xs mt-1">Search for a destination to get started</p>
                  </motion.div>
                )}
              </div>
            </ScrollableSection>
          </div>
        </div>
      </DraggablePanel>

      <BottomNavigation />
    </div>
  );
};
