import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Clock, Navigation, Search, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { ScrollableSection } from '../components/ScrollableSection';
import { apiPost } from '../config/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { 
  searchAddresses, 
  getRecentAddresses, 
  saveRecentAddress, 
  reverseGeocode,
  GeoapifyAddress,
  RECENT_ADDRESSES_UPDATED_EVENT
} from '../services/geoapifyService';

interface YourRouteProps {
  onRouteComplete?: (pickup: string, destination: string, stops: string[]) => void;
}

type ServiceType = 'ride' | 'package' | 'towing' | 'truck';

export const YourRoute: React.FC<YourRouteProps> = ({ onRouteComplete }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address: currentLocation, loading: locationLoading, latitude: geoLat, longitude: geoLng } = useGeolocation();

  const serviceType: ServiceType = location.state?.serviceType || 'ride';
  const editMode = location.state?.editMode === true;
  const editOrderId: string | undefined = location.state?.orderId;
  const editOrderType: string | undefined = location.state?.orderType;
  const editDriverId: string | null = location.state?.driverId || null;
  const editOrderData: any = location.state?.orderData || {};

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | number>('destination');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoapifyAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [extraOption, setExtraOption] = useState('');
  
  // Track coordinates for pickup and destination
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stopCoords, setStopCoords] = useState<({ lat: number; lng: number } | null)[]>([]);
  const [isSavingStop, setIsSavingStop] = useState(false);

  // Track whether we've already auto-filled pickup from GPS so we never refill
  // it after the user clears it.
  const [hasAutoFilledPickup, setHasAutoFilledPickup] = useState(false);

  // Debounce timer ref
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestRef = useRef(0);

  // Load recent addresses on mount
  useEffect(() => {
    const refreshRecentAddresses = () => setSuggestions(getRecentAddresses());
    refreshRecentAddresses();
    window.addEventListener('storage', refreshRecentAddresses);
    window.addEventListener(RECENT_ADDRESSES_UPDATED_EVENT, refreshRecentAddresses);
    return () => {
      window.removeEventListener('storage', refreshRecentAddresses);
      window.removeEventListener(RECENT_ADDRESSES_UPDATED_EVENT, refreshRecentAddresses);
    };
  }, []);

  useEffect(() => {
    if (!editMode) return;
    const state = location.state || {};
    if (state.pickup) setPickup(state.pickup);
    if (state.destination) setDestination(state.destination);
    if (Array.isArray(state.stops)) setStops(state.stops);
    if (state.pickupCoords) setPickupCoords(state.pickupCoords);
    if (state.destinationCoords) setDestinationCoords(state.destinationCoords);
    if (Array.isArray(state.stopCoords)) setStopCoords(state.stopCoords);
    setHasAutoFilledPickup(true);
    setStops((previous) => {
      const base = Array.isArray(state.stops) ? state.stops : previous;
      if (base.length >= 3) {
        setActiveField(base.length - 1);
        return base;
      }
      setActiveField(base.length);
      return [...base, ''];
    });
    setStopCoords((previous) => {
      const base = Array.isArray(state.stopCoords) ? state.stopCoords : previous;
      return base.length >= 3 ? base : [...base, null];
    });
    setSearchQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill the pick-up box with the device's current address.
  // Only runs when real GPS coordinates are confirmed (not null) and the user
  // hasn't already filled/cleared the field. We ONLY mark it as auto-filled
  // once we have actually placed a value, so a transient geocode failure can
  // never permanently leave the box empty — it will retry on the next update.
  useEffect(() => {
    if (geoLat === null || geoLng === null || pickup || hasAutoFilledPickup) {
      return;
    }

    let cancelled = false;

    const fillPickup = async () => {
      // 1. Prefer the address already resolved by the global LocationContext.
      if (currentLocation) {
        setPickup(currentLocation);
        setPickupCoords({ lat: geoLat, lng: geoLng });
        setHasAutoFilledPickup(true);
        return;
      }

      // 2. Otherwise resolve the coordinates directly via Geoapify.
      const result = await reverseGeocode(geoLat, geoLng);
      if (cancelled) return;

      if (result) {
        setPickup(result.address);
        setPickupCoords(result.coords);
        setHasAutoFilledPickup(true);
        return;
      }

      // 3. Last-resort fallback: show raw coordinates so the box is never empty.
      setPickup(`${geoLat.toFixed(5)}, ${geoLng.toFixed(5)}`);
      setPickupCoords({ lat: geoLat, lng: geoLng });
      setHasAutoFilledPickup(true);
    };

    void fillPickup();

    return () => {
      cancelled = true;
    };
  }, [geoLat, geoLng, currentLocation, pickup, hasAutoFilledPickup]);

  useEffect(() => {
    // Handle navigation state from SelectRide page
    if (location.state) {
      const {
        highlightDestination,
        highlightAddStop,
        prefilledDestination,
        prefilledPickup,
        prefilledPickupCoords,
        prefilledDestinationCoords,
        prefilledStops,
        prefilledStopCoords
      } = location.state;
      
      if (prefilledPickup) {
        setPickup(prefilledPickup);
        // Prevent the GPS auto-fill effect from overwriting the restored pickup.
        setHasAutoFilledPickup(true);
      }
      
      if (prefilledDestination) {
        setDestination(prefilledDestination);
      }

      // Restore coordinates so they are not lost when navigating back and forth.
      // Without this, returning to YourRoute and forward to SelectRide would send
      // null coordinates and the backend would report "no driver available".
      if (prefilledPickupCoords) {
        setPickupCoords(prefilledPickupCoords);
      }
      if (prefilledDestinationCoords) {
        setDestinationCoords(prefilledDestinationCoords);
      }
      if (Array.isArray(prefilledStops) && prefilledStops.length > 0) {
        setStops(prefilledStops);
        if (Array.isArray(prefilledStopCoords)) {
          setStopCoords(prefilledStopCoords);
        }
      }
      
      if (highlightDestination) {
        setActiveField('destination');
        setSearchQuery(prefilledDestination || '');
      } else if (highlightAddStop) {
        setStops(['']);
        setActiveField(0);
        setSearchQuery('');
      } else {
        setActiveField('destination');
      }
    } else {
      setActiveField('destination');
    }
  }, [location.state]);

  // Debounced search for address suggestions
  const searchForAddresses = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions(getRecentAddresses());
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    try {
      const userLocation = geoLat && geoLng ? { lat: geoLat, lng: geoLng } : undefined;
      const results = await searchAddresses(query, userLocation);
      if (requestId === searchRequestRef.current) setSuggestions(results);
    } catch (error) {
      console.error('Search error:', error);
      if (requestId === searchRequestRef.current) setSuggestions(getRecentAddresses());
    } finally {
      if (requestId === searchRequestRef.current) setIsSearching(false);
    }
  }, [geoLat, geoLng]);

  // Handle search query changes with debounce
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      searchForAddresses(searchQuery);
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, searchForAddresses]);

  const getNextEmptyField = (): 'pickup' | 'destination' | number | null => {
    if (!pickup) return 'pickup';
    if (!destination) return 'destination';
    
    for (let i = 0; i < stops.length; i++) {
      if (!stops[i] || stops[i].trim() === '') {
        return i;
      }
    }
    
    return null;
  };

  const handleFieldFocus = (field: 'pickup' | 'destination' | number) => {
    setActiveField(field);
    if (field === 'pickup') {
      // Don't seed the search with the GPS-filled pickup value — that would
      // fire a pointless search and briefly flash "Searching...".
      setSearchQuery('');
    } else if (field === 'destination') {
      setSearchQuery(destination);
    } else {
      setSearchQuery(stops[field] || '');
    }
  };

  const handleEditModeComplete = async (
    finalPickup: string,
    finalDestination: string,
    finalStops: string[],
    finalPickupCoords: { lat: number; lng: number } | null,
    finalDestinationCoords: { lat: number; lng: number } | null,
    finalStopCoords: ({ lat: number; lng: number } | null)[]
  ) => {
    if (!editOrderId || isSavingStop) return;
    setIsSavingStop(true);
    const stopsPayload = finalStops.map((address, index) => ({
      address,
      lat: finalStopCoords[index]?.lat ?? 0,
      lng: finalStopCoords[index]?.lng ?? 0
    }));

    void apiPost('/updateOrderStops', {
      orderId: editOrderId,
      driverId: editDriverId,
      stops: stopsPayload
    }).then((result: any) => {
      navigate('/driver-coming', {
        replace: true,
        state: {
          orderId: editOrderId,
          orderType: editOrderType,
          orderData: {
            ...editOrderData,
            pickup: finalPickup,
            destination: finalDestination,
            stops: result?.data?.stops ?? stopsPayload,
            fare: result?.data?.fare ?? editOrderData.fare,
            total: result?.data?.fare ?? editOrderData.total,
            polyline: result?.data?.polyline ?? editOrderData.polyline
          }
        }
      });
    }).catch((error) => {
      console.error('Failed to update trip stops:', error);
    }).finally(() => {
      setIsSavingStop(false);
    });
  };

  const handleSuggestionSelect = (suggestion: GeoapifyAddress) => {
    const address = suggestion.address;
    const coords = suggestion.coords;
    
    // Save to recent addresses
    saveRecentAddress(suggestion);
    
    let newPickup = pickup;
    let newDestination = destination;
    let newStops = [...stops];
    let newPickupCoords = pickupCoords;
    let newDestinationCoords = destinationCoords;
    let newStopCoords = [...stopCoords];

    if (activeField === 'pickup') {
      newPickup = address;
      newPickupCoords = coords;
      setPickup(address);
      setPickupCoords(coords);
    } else if (activeField === 'destination') {
      newDestination = address;
      newDestinationCoords = coords;
      setDestination(address);
      setDestinationCoords(coords);
    } else if (typeof activeField === 'number') {
      newStops[activeField] = address;
      newStopCoords[activeField] = coords;
      setStops(newStops);
      setStopCoords(newStopCoords);
    }

    setSearchQuery('');

    const checkFieldsFilled = (): boolean => {
      const hasPickup = newPickup && newPickup.trim() !== '';
      const hasDestination = newDestination && newDestination.trim() !== '';
      const allStopsFilled = newStops.length === 0 || newStops.every(stop => stop && stop.trim() !== '');
      const hasServiceOption = serviceType === 'package' || serviceType === 'truck' ? extraOption.trim() !== '' : true;
      return hasPickup && hasDestination && allStopsFilled && hasServiceOption;
    };

    const findNextEmptyField = (): 'pickup' | 'destination' | number | null => {
      if (!newPickup) return 'pickup';
      if (!newDestination) return 'destination';
      for (let i = 0; i < newStops.length; i++) {
        if (!newStops[i] || newStops[i].trim() === '') {
          return i;
        }
      }
      return null;
    };

    const nextField = findNextEmptyField();

    if (nextField !== null) {
      setActiveField(nextField);
      if (nextField === 'pickup') {
        setSearchQuery(newPickup);
      } else if (nextField === 'destination') {
        setSearchQuery(newDestination);
      } else {
        setSearchQuery(newStops[nextField] || '');
      }
    } else if (checkFieldsFilled() && editMode) {
      void handleEditModeComplete(newPickup, newDestination, newStops, newPickupCoords, newDestinationCoords, newStopCoords);
    } else if (checkFieldsFilled() && (serviceType === 'ride' || serviceType === 'package' || serviceType === 'truck')) {
      onRouteComplete?.(newPickup, newDestination, newStops);
navigate('/select-ride', {
      state: {
        serviceType,
        pickup: newPickup,
          destination: newDestination,
          stops: newStops,
          pickupCoords: newPickupCoords,
          destinationCoords: newDestinationCoords,
          stopCoords: newStopCoords
        }
      });
    }
  };

  const handleAddStop = () => {
    if (stops.length < 3) {
      const newStops = [...stops, ''];
      setStops(newStops);
      setStopCoords([...stopCoords, null]);
      setActiveField(newStops.length - 1);
      setSearchQuery('');
    }
  };

  const handleRemoveStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    const newStopCoords = stopCoords.filter((_, i) => i !== index);
    setStops(newStops);
    setStopCoords(newStopCoords);
    
    if (activeField === index) {
      const nextField = getNextEmptyField();
      setActiveField(nextField || 'destination');
    }
  };

  const handleInputChange = (value: string) => {
    if (activeField === 'pickup') {
      setPickup(value);
    } else if (activeField === 'destination') {
      setDestination(value);
    } else if (typeof activeField === 'number') {
      const newStops = [...stops];
      newStops[activeField] = value;
      setStops(newStops);
    }
    
    setSearchQuery(value);
  };

  const getPlaceholder = (field: 'pickup' | 'destination' | number) => {
    if (field === 'pickup') return 'Search pick-up location';
    if (field === 'destination') return 'Destination';
    return 'Add stop';
  };

  const isFieldActive = (field: 'pickup' | 'destination' | number): boolean => {
    return activeField === field;
  };

  const getButtonLabel = (): string => {
    switch (serviceType) {
      case 'towing':
        return 'Go to Select Tow';
      case 'package':
        return 'Go to Select Delivery';
      case 'truck':
        return 'Go to Select Truck';
      default:
        return '';
    }
  };

  const handleLogisticsNavigate = () => {
    if (!pickup || !destination || !extraOption) return;

    onRouteComplete?.(pickup, destination, stops);
    navigate('/select-ride', {
      state: {
        serviceType,
        pickup,
        destination,
        stops,
        extraOption,
        pickupCoords,
        destinationCoords,
        stopCoords
      }
    });
  };

  const isLogisticsButtonEnabled = (): boolean => {
    return pickup !== '' && destination !== '' && extraOption !== '';
  };

  const renderTowingOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl border border-orange-200 dark:border-orange-800"
    >
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">What&apos;s your vehicle?</label>
      <select
        value={extraOption}
        onChange={(e) => setExtraOption(e.target.value)}
        className="w-full bg-white dark:bg-gray-800 border-2 border-orange-300 dark:border-orange-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
      >
        <option value="">Select vehicle type</option>
        <option value="sedan">Sedan</option>
        <option value="suv">SUV</option>
        <option value="bakkie">Bakkie</option>
        <option value="small-truck">Small Truck</option>
        <option value="van">Van</option>
      </select>
    </motion.div>
  );

  const renderPackageOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 p-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-300 dark:border-gray-600"
    >
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">What&apos;s the weight of your package?</label>
      <select
        value={extraOption}
        onChange={(e) => setExtraOption(e.target.value)}
        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
      >
        <option value="">Select weight</option>
        <option value="0-5kg">0-5 kg</option>
        <option value="5-10kg">5-10 kg</option>
        <option value="10-20kg">10-20 kg</option>
        <option value="20-50kg">20-50 kg</option>
      </select>
    </motion.div>
  );

  const renderTruckOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-2xl border border-cyan-200 dark:border-cyan-800"
    >
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">What do you want to move?</label>
      <select
        value={extraOption}
        onChange={(e) => setExtraOption(e.target.value)}
        className="w-full bg-white dark:bg-gray-800 border-2 border-cyan-300 dark:border-cyan-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
      >
        <option value="">Select item type</option>
        <option value="house-shifting">House Shifting</option>
        <option value="farm-produce">Farm Produce</option>
        <option value="construction-material">Construction Material</option>
        <option value="building-sand">Building Sand</option>
        <option value="furniture">Furniture</option>
        <option value="bulk-goods">Bulk Goods</option>
      </select>
    </motion.div>
  );

  // Build map markers for preview
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    
    if (pickupCoords?.lat && pickupCoords?.lng) {
      markers.push({
        id: 'pickup',
        type: 'pickup',
        lat: pickupCoords.lat,
        lng: pickupCoords.lng
      });
    }
    
    if (destinationCoords?.lat && destinationCoords?.lng) {
      markers.push({
        id: 'dropoff',
        type: 'dropoff',
        lat: destinationCoords.lat,
        lng: destinationCoords.lng
      });
    }
    
    // Add stop markers
    stopCoords.forEach((coords, index) => {
      if (coords?.lat && coords?.lng) {
        markers.push({
          id: `stop-${index}`,
          type: 'stop',
          lat: coords.lat,
          lng: coords.lng,
          label: `${index + 1}`
        });
      }
    });
    
    return markers;
  }, [pickupCoords, destinationCoords, stopCoords]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Real MapLibre Map Background */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={geoLat && geoLng 
            ? { lat: geoLat, lng: geoLng } 
            : { lat: -15.3875, lng: 28.3228 }}
          zoom={13}
          markers={mapMarkers}
          fitBounds={mapMarkers.length > 1}
          className="w-full h-full"
        />
      </div>
      
      {/* Header */}
      <motion.div 
        className="absolute top-0 left-0 right-0 z-10 p-4 bg-white dark:bg-gray-900 shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              navigate(-1);
            }}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-800 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Your route</h1>
          <div className="w-10" />
        </div>
      </motion.div>

      {/* Route Form */}
      <motion.div 
        className="absolute top-16 left-0 right-0 bottom-0 bg-white dark:bg-gray-900 z-10 p-4 pt-8"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="space-y-4">
          {/* Pickup Location */}
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-[#5B2EFF] rounded-full flex-shrink-0"></div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={pickup}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => handleFieldFocus('pickup')}
                placeholder={locationLoading ? 'Getting your location...' : getPlaceholder('pickup')}
                className={`w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 pr-10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all ${
                  isFieldActive('pickup') 
                    ? 'ring-2 ring-[#5B2EFF] bg-white dark:bg-gray-700 shadow-lg shadow-[#5B2EFF]/20 border-2 border-[#5B2EFF]' 
                    : 'focus:ring-2 focus:ring-[#5B2EFF] focus:bg-white dark:focus:bg-gray-700'
                }`}
              />
              {locationLoading && !pickup ? (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#5B2EFF] animate-spin" />
              ) : pickup && activeField === 'pickup' ? (
                <button
                  onClick={() => {
                    setPickup('');
                    setPickupCoords(null);
                    setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center"
                >
                  <X size={14} className="text-gray-600 dark:text-gray-300" />
                </button>
              ) : null}
            </div>
            <button
              onClick={handleAddStop}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              disabled={stops.length >= 3}
            >
              <Plus size={20} className={stops.length >= 3 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300'} />
            </button>
          </div>

          {/* Add Stops */}
          <AnimatePresence>
            {stops.map((stop, index) => (
              <motion.div
                key={index}
                className="flex items-center space-x-3 ml-6"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-3 h-3 bg-[#5B2EFF] rounded-full flex-shrink-0"></div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={stop}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => handleFieldFocus(index)}
                    placeholder={getPlaceholder(index)}
                    className={`w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all ${
                      isFieldActive(index) 
                        ? 'ring-2 ring-[#5B2EFF] bg-white dark:bg-gray-700 shadow-lg shadow-[#5B2EFF]/20 border-2 border-[#5B2EFF]' 
                        : 'focus:ring-2 focus:ring-[#5B2EFF] focus:bg-white dark:focus:bg-gray-700'
                    }`}
                  />
                </div>
                <button
                  onClick={() => handleRemoveStop(index)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={16} className="text-red-500" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Destination */}
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={destination}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => handleFieldFocus('destination')}
                placeholder={getPlaceholder('destination')}
                className={`w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none transition-all ${
                  isFieldActive('destination')
                    ? 'ring-2 ring-[#5B2EFF] bg-white dark:bg-gray-700 shadow-lg shadow-[#5B2EFF]/20 border-2 border-[#5B2EFF]'
                    : 'focus:ring-2 focus:ring-[#5B2EFF] focus:bg-white dark:focus:bg-gray-700'
                }`}
              />
              {isSearching ? (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5B2EFF] animate-spin" size={20} />
              ) : (
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
              )}
            </div>
            <div className="w-10 flex items-center justify-center">
              <div className="flex flex-col space-y-1">
                <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {serviceType === 'towing' && renderTowingOptions()}
          {serviceType === 'package' && renderPackageOptions()}
          {serviceType === 'truck' && renderTruckOptions()}

          {/* Address Suggestions */}
          <ScrollableSection maxHeight="max-h-96">
            <div className="space-y-2 mt-6">
              {/* Show loading indicator if searching */}
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="text-[#5B2EFF] animate-spin mr-2" size={20} />
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Searching...</span>
                </div>
              )}

              {/* Show suggestions */}
              {!isSearching && suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.id}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Clock className="text-gray-400 dark:text-gray-500 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{suggestion.address}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{suggestion.description}</p>
                  </div>
                  {suggestion.distance && (
                    <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">{suggestion.distance}</span>
                  )}
                </motion.button>
              ))}
              
              {/* My Location Option */}
              {geoLat && geoLng && (
                <motion.button
                  onClick={async () => {
                    const reverseResult = await reverseGeocode(geoLat, geoLng);
                    if (reverseResult) {
                      handleSuggestionSelect(reverseResult);
                    } else {
                      handleSuggestionSelect({
                        id: 'current-location',
                        address: currentLocation || 'Current Location',
                        description: 'Your current location',
                        coords: { lat: geoLat, lng: geoLng }
                      });
                    }
                  }}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: suggestions.length * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Navigation className="text-[#5B2EFF] flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#5B2EFF]">My location</p>
                    {currentLocation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{currentLocation}</p>
                    )}
                  </div>
                </motion.button>
              )}
            </div>
          </ScrollableSection>
        </div>

        {/* Dynamic Bottom Button - Only for non-ride services */}
        {serviceType !== 'ride' && serviceType !== 'package' && serviceType !== 'truck' && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-gray-900 via-white dark:via-gray-900 to-transparent"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', damping: 20, stiffness: 300 }}
          >
            <motion.button
              onClick={handleLogisticsNavigate}
              disabled={!isLogisticsButtonEnabled()}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all ${
                !isLogisticsButtonEnabled()
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-[#5B2EFF] text-white shadow-lg hover:shadow-xl hover:bg-[#4A25D9]'
              }`}
              whileTap={!isLogisticsButtonEnabled() ? {} : { scale: 0.98 }}
              whileHover={!isLogisticsButtonEnabled() ? {} : { y: -2 }}
            >
              {getButtonLabel()}
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
