import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Clock, ChevronRight, Loader2, Navigation } from 'lucide-react';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { fetchStoreById, fetchStoresByCategory, fetchProductsByStore, isStoreOpen } from '../services/storeService';
import { brandKeyOf, DEFAULT_ITEM_KG, parseUnitToKg, Product } from '../data/storesData';
import { haversineDistanceKm } from '../utils/geoUtils';
import { 
  searchAddresses, 
  getRecentAddresses, 
  saveRecentAddress, 
  reverseGeocode,
  GeoapifyAddress 
} from '../services/geoapifyService';

interface Stop {
  id: string;
  address: string;
  description?: string;
  foodIds: string[];
}

export function FoodiesRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { address: currentLocation, latitude: geoLat, longitude: geoLng, loading: locationLoading } = useGeolocation();
  const { cart, removeFromCart, getTotalKgExact } = useGlobalCart();

  const currentLocationInputRef = useRef<HTMLInputElement>(null);
  const stopInputRefs = useRef<{ [key: string]: HTMLInputElement }>({});
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Geoapify search state
  const [addressSuggestions, setAddressSuggestions] = useState<GeoapifyAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load saved route data from localStorage if available. We also restore the
  // delivery + stop coordinates so they are NOT lost when navigating back from
  // FoodDelivery and forward again (otherwise the backend would report missing
  // coordinates).
  const loadRouteData = () => {
    const stored = localStorage.getItem('FOODIES_ROUTE_DATA');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const restoredStopCoords: { [key: string]: { lat: number; lng: number } } = {};
        (data.stops || []).forEach((stop: any) => {
          if (stop?.id && stop?.lat && stop?.lng) {
            restoredStopCoords[stop.id] = { lat: stop.lat, lng: stop.lng };
          }
        });
        return {
          stops: data.stops || [],
          deliveryLocation: data.deliveryLocation || '',
          deliveryCoords: data.deliveryCoords || null,
          stopCoords: restoredStopCoords
        };
      } catch (error) {
        console.error('Error loading route data:', error);
      }
    }
    return { stops: [], deliveryLocation: '', deliveryCoords: null, stopCoords: {} };
  };

  const initialData = loadRouteData();

  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(initialData.deliveryCoords);
  const [stopCoords, setStopCoords] = useState<{ [key: string]: { lat: number; lng: number } }>(initialData.stopCoords);

  const [stops, setStops] = useState<Stop[]>(initialData.stops);
  const [deliveryLocation, setDeliveryLocation] = useState(initialData.deliveryLocation);
  const [currentLocationQuery, setCurrentLocationQuery] = useState(initialData.deliveryLocation);
  const [stopAddressQuery, setStopAddressQuery] = useState<{ [key: string]: string }>({});
  const [activeLocationInput, setActiveLocationInput] = useState('current-location');
  const [showRecentAddresses, setShowRecentAddresses] = useState(true);
  const [hasAutoFilled, setHasAutoFilled] = useState(!!initialData.deliveryLocation);
  const [showCurrentLocationModal, setShowCurrentLocationModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState<string | null>(null);
  const [nearerBranch, setNearerBranch] = useState<{ store: any; currentKm: number; nearerKm: number } | null>(null);

  const assignedToStopsIds = useMemo(() => {
    const ids: string[] = [];
    stops.forEach(stop => {
      ids.push(...stop.foodIds);
    });
    return ids;
  }, [stops]);

  const unselectedFoods = useMemo(() => {
    return cart.filter(food => !assignedToStopsIds.includes(food.id));
  }, [cart, assignedToStopsIds]);

  const maxAssignable = cart.length - 1;
  const MAX_STOPS = 3;
  const canAddStop = unselectedFoods.length > 1 && stops.length < MAX_STOPS;

  console.log('Cart:', cart.length);
  console.log('Stops:', stops.length);
  console.log('Assigned to stops:', assignedToStopsIds.length);
  console.log('Unselected foods:', unselectedFoods.length);
  console.log('Can add stop:', canAddStop);
  console.log('Max stops reached:', stops.length >= MAX_STOPS);

  // Load recent addresses on mount
  useEffect(() => {
    setAddressSuggestions(getRecentAddresses());
  }, []);

  // Debounced search for addresses
  const searchForAddresses = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAddressSuggestions(getRecentAddresses());
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const userLocation = geoLat && geoLng ? { lat: geoLat, lng: geoLng } : undefined;
      const results = await searchAddresses(query, userLocation);
      setAddressSuggestions(results);
    } catch (error) {
      console.error('Search error:', error);
      setAddressSuggestions(getRecentAddresses());
    } finally {
      setIsSearching(false);
    }
  }, [geoLat, geoLng]);

  // Handle search query changes with debounce
  const handleSearchDebounce = useCallback((query: string) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      searchForAddresses(query);
    }, 300);
  }, [searchForAddresses]);

  // Auto-fill the delivery location with the device's current address.
  // Runs as soon as real GPS coordinates are confirmed — it does NOT wait for
  // the shared context address, and falls back to a direct geocode (and then
  // raw coordinates) so a transient failure can never leave the box empty.
  // We only mark it auto-filled once a value has actually been placed.
  useEffect(() => {
    if (deliveryLocation) {
      if (!currentLocationQuery) setCurrentLocationQuery(deliveryLocation);
      return;
    }
    if (geoLat === null || geoLng === null || hasAutoFilled) {
      return;
    }

    let cancelled = false;

    const fillDelivery = async () => {
      // 1. Prefer the address already resolved by the global LocationContext.
      if (currentLocation) {
        setDeliveryLocation(currentLocation);
        setCurrentLocationQuery(currentLocation);
        setDeliveryCoords({ lat: geoLat, lng: geoLng });
        setHasAutoFilled(true);
        return;
      }

      // 2. Otherwise resolve the coordinates directly via Geoapify.
      const result = await reverseGeocode(geoLat, geoLng);
      if (cancelled) return;

      const resolved = result?.address ?? `${geoLat.toFixed(5)}, ${geoLng.toFixed(5)}`;
      setDeliveryLocation(resolved);
      setCurrentLocationQuery(resolved);
      setDeliveryCoords({ lat: geoLat, lng: geoLng });
      setHasAutoFilled(true);
    };

    void fillDelivery();

    return () => {
      cancelled = true;
    };
  }, [geoLat, geoLng, currentLocation, deliveryLocation, hasAutoFilled, currentLocationQuery]);


  useEffect(() => {
    if (location.state) {
      const { highlightCurrentLocation, autoAddStop } = location.state;

      if (highlightCurrentLocation) {
        setActiveLocationInput('current-location');
        setTimeout(() => currentLocationInputRef.current?.focus(), 100);
      }

      if (autoAddStop && canAddStop) {
        handleAddStop();
      }

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const handleCurrentLocationChange = (value: string) => {
    setCurrentLocationQuery(value);
    setDeliveryLocation(value);
    // Keep the suggestions panel visible while typing so live address results
    // appear (just like on the Your Route page).
    setShowRecentAddresses(true);
    handleSearchDebounce(value);
  };

  const handleCurrentLocationSelect = (address: string) => {
    setDeliveryLocation(address);
    setCurrentLocationQuery(address);
    setShowRecentAddresses(true);
    setActiveLocationInput('current-location');

    if (stops.length > 0 && !stops[0].address) {
      setTimeout(() => {
        setActiveLocationInput(stops[0].id);
        stopInputRefs.current[stops[0].id]?.focus();
      }, 100);
    }
  };

  const handleClearCurrentLocation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentLocationQuery('');
    setDeliveryLocation('');
    setShowRecentAddresses(true);
    setTimeout(() => currentLocationInputRef.current?.focus(), 0);
  };

  const handleStopAddressChange = (stopId: string, value: string) => {
    setStops(prev => prev.map(stop =>
      stop.id === stopId ? { ...stop, address: value } : stop
    ));
    setStopAddressQuery(prev => ({ ...prev, [stopId]: value }));
    // Keep the suggestions panel visible while typing so live address results appear.
    setShowRecentAddresses(true);
    handleSearchDebounce(value);
  };

  const handleStopAddressSelect = (stopId: string, address: string, description: string) => {
    setStops(prev => prev.map(stop =>
      stop.id === stopId ? { ...stop, address, description } : stop
    ));
    setStopAddressQuery(prev => ({ ...prev, [stopId]: '' }));
    setShowRecentAddresses(true);

    const currentIndex = stops.findIndex(s => s.id === stopId);
    if (currentIndex < stops.length - 1) {
      const nextStop = stops[currentIndex + 1];
      if (!nextStop.address) {
        setTimeout(() => {
          setActiveLocationInput(nextStop.id);
          stopInputRefs.current[nextStop.id]?.focus();
        }, 100);
      }
    }
  };

  const handleClearStop = (e: React.MouseEvent, stopId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setStops(prev => prev.map(stop =>
      stop.id === stopId ? { ...stop, address: '' } : stop
    ));
    setStopAddressQuery(prev => ({ ...prev, [stopId]: '' }));
    setShowRecentAddresses(true);
    setTimeout(() => stopInputRefs.current[stopId]?.focus(), 0);
  };

  const handleAddStop = () => {
    if (!canAddStop) return;

    const newStop: Stop = {
      id: `stop-${Date.now()}`,
      address: '',
      foodIds: []
    };
    setStops(prev => [...prev, newStop]);
    setTimeout(() => {
      setActiveLocationInput(newStop.id);
      stopInputRefs.current[newStop.id]?.focus();
      setShowRecentAddresses(true);
    }, 100);
  };

  const handleRemoveStop = (stopId: string) => {
    setStops(prev => prev.filter(stop => stop.id !== stopId));
    setActiveLocationInput('current-location');
    setShowRecentAddresses(true);
  };

  const handleToggleFoodForStop = (stopId: string, foodId: string) => {
    setStops(prev => prev.map(stop => {
      if (stop.id !== stopId) return stop;

      const isSelected = stop.foodIds.includes(foodId);
      if (isSelected) {
        return { ...stop, foodIds: stop.foodIds.filter(id => id !== foodId) };
      } else {
        if (assignedToStopsIds.length >= maxAssignable) {
          return stop;
        }
        return { ...stop, foodIds: [...stop.foodIds, foodId] };
      }
    }));
  };

  const handleRemoveFoodFromCurrentLocation = (foodId: string) => {
    const isAssignedToStops = assignedToStopsIds.includes(foodId);
    const isMaxReached = assignedToStopsIds.length >= maxAssignable;

    if (isMaxReached && !isAssignedToStops) {
      return;
    }

    removeFromCart(foodId);

    setStops(prev => prev
      .map(stop => ({
        ...stop,
        foodIds: stop.foodIds.filter(id => id !== foodId)
      }))
      .filter(stop => stop.foodIds.length > 0 || stop.address)
    );
  };

  useEffect(() => {
    if (!deliveryCoords || !cart[0]?.storeId || !cart[0]?.storeName || localStorage.getItem(`BRANCH_CHOICE_${cart[0].storeId}`)) return;
    let cancelled = false;
    void (async () => {
      const current = await fetchStoreById(cart[0].storeId);
      const branches = await fetchStoresByCategory(cart[0].category);
      if (cancelled || !current?.location) return;
      const currentKm = haversineDistanceKm(deliveryCoords.lat, deliveryCoords.lng, current.location.lat, current.location.lng);
      const nearer = branches.filter(branch => brandKeyOf(branch.storeName) === brandKeyOf(cart[0].storeName) && branch.id !== current.id && isStoreOpen(branch.openingHours).isOpen && branch.location)
        .map(branch => ({ store: branch, km: haversineDistanceKm(deliveryCoords.lat, deliveryCoords.lng, branch.location!.lat, branch.location!.lng) }))
        .sort((a, b) => a.km - b.km)[0];
      if (nearer && currentKm - nearer.km >= 1) setNearerBranch({ store: nearer.store, currentKm, nearerKm: nearer.km });
    })().catch(error => console.error('Branch comparison failed:', error));
    return () => { cancelled = true; };
  }, [deliveryCoords, cart]);

  const switchToNearerBranch = async () => {
    if (!nearerBranch) return;
    const products = await fetchProductsByStore(nearerBranch.store.id);
    const missing: string[] = [];
    const replacementCart = cart.flatMap(item => {
      const product = products.find(candidate => candidate.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (!product) { missing.push(item.name); return []; }
      return [{ ...item, id: `${product.id}-${Date.now()}-${Math.random()}`, storeId: nearerBranch.store.id, storeName: nearerBranch.store.storeName, storeAddress: nearerBranch.store.address, image: product.imageUrl, price: product.price, unit: product.unit, kg: parseUnitToKg(product.unit, DEFAULT_ITEM_KG[item.category]) }];
    });
    if (missing.length && !window.confirm(`These items are not at the nearer branch: ${missing.join(', ')}. They will be removed.`)) return;
    localStorage.setItem('GLOBAL_CART', JSON.stringify(replacementCart));
    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify({ ...JSON.parse(localStorage.getItem('FOODIES_ROUTE_DATA') || '{}'), storeId: nearerBranch.store.id, storeName: nearerBranch.store.storeName, storeAddress: nearerBranch.store.address, storeLocation: nearerBranch.store.location, storeImage: nearerBranch.store.logo, cart: replacementCart, timestamp: Date.now() }));
    localStorage.setItem(`BRANCH_CHOICE_${nearerBranch.store.id}`, 'switched');
    window.location.reload();
  };

  const handleKeepBranch = () => { if (cart[0]?.storeId) localStorage.setItem(`BRANCH_CHOICE_${cart[0].storeId}`, 'kept'); setNearerBranch(null); };

  const handleGoToDelivery = async () => {
    // Save route data to localStorage before navigation
    // Get store info from first cart item
    const storeId = cart[0]?.storeId || '';
    const storeName = cart[0]?.storeName || '';
    const storeAddress = cart[0]?.storeAddress || ''; // Real store address from Firestore
    const category = cart[0]?.category || 'food';

    // Fetch the store document to get its real GPS coordinates. FoodDelivery
    // requires real store coordinates to request delivery options from the backend.
    let storeLocation = (cart[0] as any)?.storeLocation || { lat: null, lng: null };
    let storeImage = '';
    try {
      if (storeId) {
        const storeDoc = await fetchStoreById(storeId);
        storeLocation = storeDoc?.location ?? storeLocation;
        storeImage = storeDoc?.logo || '';
      }
    } catch (error) {
      console.error('Failed to fetch store location:', error);
    }
    
    const routeData = {
      deliveryLocation,
      deliveryCoords, // The selected delivery address coordinates
      storeId,
      storeName,
      storeAddress,
      storeLocation, // Store GPS coordinates
      storeImage,
      category,
      stops: stops.map(stop => ({
        id: stop.id,
        address: stop.address,
        description: stop.description,
        foodIds: stop.foodIds,
        lat: stopCoords[stop.id]?.lat ?? 0, // Real stop latitude
        lng: stopCoords[stop.id]?.lng ?? 0  // Real stop longitude
      })),
      cart: cart.map(item => ({
        id: item.id,
        storeId: item.storeId,
        storeName: item.storeName,
        storeAddress: item.storeAddress,
        category: item.category,
        name: item.name,
        image: item.image,
        price: item.price,
        unit: item.unit ?? null,
        kg: item.kg ?? 0
      })),
      totalKg: getTotalKgExact(),
      timestamp: Date.now()
    };

    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(routeData));
    console.log('📦 Saved route data to localStorage:', routeData);

    navigate('/food-delivery');
  };

  const pickupLocation = cart[0]?.storeName || 'Store';
  const pickupAddress = cart[0]?.storeAddress || '';

  const getFoodCountForStop = (stopId: string): number => {
    const stop = stops.find(s => s.id === stopId);
    return stop ? stop.foodIds.length : 0;
  };

  const getStopButtonText = (stopId: string): string => {
    const count = getFoodCountForStop(stopId);
    if (count === 0) return 'Add item';
    return count === 1 ? `${count} item added` : `${count} items added`;
  };

  const isFoodDisabled = (foodId: string, stopId: string): boolean => {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return false;

    const isAlreadySelected = stop.foodIds.includes(foodId);
    if (isAlreadySelected) return false;

    const isAssignedToOtherStop = assignedToStopsIds.includes(foodId) && !stop.foodIds.includes(foodId);
    if (isAssignedToOtherStop) return true;

    if (assignedToStopsIds.length >= maxAssignable) return true;

    return false;
  };

  const canDeleteFood = (foodId: string): boolean => {
    const isAssignedToStops = assignedToStopsIds.includes(foodId);
    const isMaxReached = assignedToStopsIds.length >= maxAssignable;

    if (isMaxReached && !isAssignedToStops) {
      return false;
    }

    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950"
    >
      <div className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        {nearerBranch && <div className="bg-purple-50 px-4 py-3 text-xs text-purple-900"><p><strong>{nearerBranch.store.storeName}</strong> is {nearerBranch.nearerKm.toFixed(1)} km from your address and {cart[0]?.storeName} is {nearerBranch.currentKm.toFixed(1)} km. Switch to the nearer branch?</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => void switchToNearerBranch()} className="rounded-full bg-[#5B2EFF] px-3 py-1.5 font-semibold text-white">Switch</button><button type="button" onClick={handleKeepBranch} className="rounded-full border border-purple-300 px-3 py-1.5 font-semibold">Keep</button></div></div>}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <motion.button
              onClick={() => navigate(-1)}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            >
              <X size={20} className="text-gray-800 dark:text-gray-200" />
            </motion.button>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{pickupLocation}</span>
                <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">→</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{deliveryLocation.split(',')[0] || 'Delivery'}</span>
              </div>
              {pickupAddress && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{pickupAddress}</span>
              )}
            </div>

            <motion.button
              onClick={handleAddStop}
              disabled={!canAddStop}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                canAddStop
                  ? 'bg-[#5B2EFF] hover:bg-[#4A24D9] text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              whileTap={{ scale: canAddStop ? 0.95 : 1 }}
            >
              <Plus size={16} />
            </motion.button>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></div>
              <div className={`flex-1 relative flex items-center rounded-lg px-3 py-2 transition-all ${
                activeLocationInput === 'current-location'
                  ? 'bg-white dark:bg-gray-800 border border-[#5B2EFF] shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 border border-transparent'
              }`}>
                <input
                  ref={currentLocationInputRef}
                  type="text"
                  value={currentLocationQuery}
                  onChange={(e) => handleCurrentLocationChange(e.target.value)}
                  onFocus={() => {
                    setActiveLocationInput('current-location');
                    setShowRecentAddresses(true);
                  }}
                  placeholder={locationLoading ? 'Getting your location...' : 'Delivery location'}
                  className="flex-1 bg-transparent text-gray-900 dark:text-white text-xs outline-none placeholder-gray-500 dark:placeholder-gray-400"
                />
                {locationLoading && !currentLocationQuery && (
                  <Loader2 size={14} className="mr-2 text-[#5B2EFF] animate-spin flex-shrink-0" />
                )}
                {currentLocationQuery && (
                  <motion.button
                    onClick={handleClearCurrentLocation}
                    onMouseDown={(e) => e.preventDefault()}
                    className="mr-2 w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={10} className="text-white" />
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setShowCurrentLocationModal(true)}
                  disabled={cart.length === 0}
                  className="relative ml-2 flex items-center gap-1 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileTap={{ scale: cart.length > 0 ? 0.95 : 1 }}
                >
                   
                  <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">View your {unselectedFoods.length === 1 ? 'item' : 'items'}</span>
                  {unselectedFoods.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      {unselectedFoods.length}
                    </motion.span>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {stops.map((stop) => (
              <motion.div
                key={stop.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 relative"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#5B2EFF] rounded-full flex-shrink-0"></div>
                  <div className={`flex-1 relative flex items-center rounded-lg px-3 py-2 transition-all ${
                    activeLocationInput === stop.id
                      ? 'bg-white dark:bg-gray-800 border border-[#5B2EFF] shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 border border-transparent'
                  }`}>
                    <input
                      ref={(el) => {
                        if (el) stopInputRefs.current[stop.id] = el;
                      }}
                      type="text"
                      value={stop.address ?? ''}
                      onChange={(e) => handleStopAddressChange(stop.id, e.target.value)}
                      onFocus={() => {
                        setActiveLocationInput(stop.id);
                        setShowRecentAddresses(true);
                      }}
                      placeholder="Stop location"
                      className="flex-1 bg-transparent text-gray-900 dark:text-white text-xs outline-none placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    {stop.address && (
                      <motion.button
                        onClick={(e) => handleClearStop(e, stop.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="mr-2 w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        <X size={10} className="text-white" />
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => setShowStopModal(stop.id)}
                      className="ml-2 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors relative"
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                        {getStopButtonText(stop.id)}
                      </span>
                      {getFoodCountForStop(stop.id) > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                        >
                          {getFoodCountForStop(stop.id)}
                        </motion.span>
                      )}
                    </motion.button>
                  </div>
                  <button
                    onClick={() => handleRemoveStop(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                  >
                    <X size={14} className="text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-40 px-3 pb-20">
        {showRecentAddresses && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 px-2">
              {isSearching
                ? 'Searching...'
                : activeLocationInput === 'current-location' && currentLocationQuery !== ''
                  ? 'Search results'
                  : activeLocationInput !== 'current-location' && (stopAddressQuery[activeLocationInput as string] ?? '') !== ''
                    ? 'Search results'
                    : 'Suggested locations'}
            </p>

            {isSearching && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 size={14} className="text-[#5B2EFF] animate-spin" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Finding addresses...</span>
              </div>
            )}

            {currentLocationQuery === '' && currentLocation && activeLocationInput === 'current-location' && (
              <motion.button
                onClick={() => handleCurrentLocationSelect(currentLocation)}
                className="w-full flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors shadow-sm border border-purple-200 dark:border-purple-800"
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock size={16} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 dark:text-white text-xs">Current location</p>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400">{currentLocation.split(',')[0]}</p>
                </div>
              </motion.button>
            )}

            {addressSuggestions.slice(0, 5).map((addr) => (
              <motion.button
                key={addr.id}
                onClick={() => {
                  if (activeLocationInput === 'current-location') {
                    handleCurrentLocationSelect(addr.address);
                    // Save coords
                    setDeliveryCoords(addr.coords);
                    saveRecentAddress(addr);
                  } else {
                    handleStopAddressSelect(activeLocationInput as string, addr.address, addr.description);
                    // Save stop coords
                    setStopCoords(prev => ({
                      ...prev,
                      [activeLocationInput as string]: addr.coords
                    }));
                    saveRecentAddress(addr);
                  }
                }}
                className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                whileTap={{ scale: 0.98 }}
              >
                <Clock size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 dark:text-white text-xs">{addr.address.split(',')[0]}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{addr.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <motion.div
        className="fixed bottom-0 left-0 right-0 p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-20"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.2 }}
      >
        <motion.button
          onClick={handleGoToDelivery}
          disabled={cart.length === 0}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            cart.length > 0
              ? 'bg-[#5B2EFF] text-white hover:bg-[#4A24D9] shadow-lg'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
          whileTap={{ scale: cart.length > 0 ? 0.98 : 1 }}
          whileHover={{ scale: cart.length > 0 ? 1.02 : 1 }}
        >
          Go to delivery
          <motion.div
            animate={{ x: [0, 3, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >
            <ChevronRight size={16} />
          </motion.div>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showCurrentLocationModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCurrentLocationModal(false)}
            />

            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your {unselectedFoods.length === 1 ? 'Item' : 'Items'} ({unselectedFoods.length})</h2>
                <motion.button
                  onClick={() => setShowCurrentLocationModal(false)}
                  className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={20} className="text-gray-600 dark:text-gray-400" />
                </motion.button>
              </div>

              <div className="px-6 py-4 space-y-3 pb-24">
                {cart.map((item, index) => {
                  const canDelete = canDeleteFood(item.id);

                  return (
                    <motion.div
                      key={item.id}
                      className="w-full p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center space-x-4"
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">K{item.price}</p>
                      </div>

                      {canDelete && (
                        <motion.button
                          onClick={() => handleRemoveFoodFromCurrentLocation(item.id)}
                          className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          whileTap={{ scale: 0.9 }}
                        >
                          <X size={16} className="text-white" />
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStopModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStopModal(null)}
            />

            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select Items for Stop</h2>
                <motion.button
                  onClick={() => setShowStopModal(null)}
                  className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={20} className="text-gray-600 dark:text-gray-400" />
                </motion.button>
              </div>

              <div className="px-6 py-4 space-y-3 pb-24">
                {cart.map((item, index) => {
                  const stop = stops.find(s => s.id === showStopModal);
                  const isSelected = stop?.foodIds.includes(item.id) || false;
                  const isDisabled = isFoodDisabled(item.id, showStopModal);

                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => !isDisabled && handleToggleFoodForStop(showStopModal, item.id)}
                      disabled={isDisabled}
                      className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center space-x-4 ${
                        isSelected
                          ? 'border-[#5B2EFF] bg-[#F3EEFF] dark:bg-purple-900/20'
                          : isDisabled
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
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
                        <p className="text-sm text-gray-600 dark:text-gray-400">K{item.price}</p>
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
                className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-6"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.button
                  onClick={() => setShowStopModal(null)}
                  className="w-full bg-[#5B2EFF] text-white font-bold py-4 rounded-2xl hover:bg-[#4A24D9] transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  OK
                </motion.button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
