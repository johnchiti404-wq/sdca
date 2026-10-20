import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, PanInfo, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { X, Plus, Calendar, User, Briefcase, ChevronDown, RefreshCw, Users } from 'lucide-react';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { apiPost } from '../config/api';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { LocationPickerOverlay, LocationEditMode, LocationCoordinate } from '../components/LocationPickerOverlay';
import { useNearbyDrivers, LUSAKA_DEFAULT } from '../hooks/useNearbyDrivers';
import { haversineDistanceKm } from '../utils/geoUtils';
import {
  BackendRideOption,
  getVehicleConfig,
  filterOptionsByService,
  enrichRideOption,
  sortOptionsWithRecommendedFirst
} from '../config/vehicleConfig';

type FilterTab = 'standard' | 'faster' | 'cheaper';

const PROMO_TEXT = '30% promo applied';
const PROMO_ACTIVE = true;
const PROMO_DISCOUNT = 30;

const PANEL_MIN_HEIGHT = 36;
const PANEL_MAX_HEIGHT = 85;
const SNAP_THRESHOLD = 65;

// Skeleton Card Component for loading state
const DeliverySkeletonCard: React.FC<{ index: number }> = ({ index }) => (
  <motion.div
    className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    <div className="flex items-center space-x-4">
      <div className="w-16 h-16 rounded-xl bg-gray-200 animate-pulse" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  </motion.div>
);

export function FoodDelivery() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, getKgRange, getTotalKgExact } = useGlobalCart();
  const { latitude, longitude } = useGeolocation();

  // Load data from localStorage (from FoodiesRoute)
  const [routeData, setRouteData] = useState<any>(() => {
    const stored = localStorage.getItem('FOODIES_ROUTE_DATA');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading route data:', error);
        return null;
      }
    }
    return null;
  });

  // Backend delivery options state
  const [deliveryOptions, setDeliveryOptions] = useState<BackendRideOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState<BackendRideOption | null>(null);
  const [routePolyline, setRoutePolyline] = useState<string | null>(null);
  const nearbyDrivers = useNearbyDrivers(latitude, longitude);

  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('standard');
  const [profileToggle, setProfileToggle] = useState<'personal' | 'business'>('personal');
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledToTop, setIsScrolledToTop] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [locationEditMode, setLocationEditMode] = useState<LocationEditMode | null>(null);
  const [locationCenter, setLocationCenter] = useState<LocationCoordinate | null>(null);
  const [locationEditAddress, setLocationEditAddress] = useState('');

  // Spring-driven panel height for smooth animations
  const rawPanelVh = useMotionValue(PANEL_MIN_HEIGHT);
  const springPanelVh = useSpring(rawPanelVh, {
    stiffness: 300,
    damping: 35,
    mass: 0.8,
  });
  const panelHeightStyle = useTransform(springPanelVh, (v) => `${v}vh`);

  const [isExpanded, setIsExpanded] = useState(false);

  // Track expansion state from spring value
  useEffect(() => {
    const unsubscribe = springPanelVh.on('change', (latest) => {
      setIsExpanded(latest > SNAP_THRESHOLD);
    });
    return unsubscribe;
  }, [springPanelVh]);

  // Track scroll position to determine when to allow panel drag
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolledToTop(scrollRef.current.scrollTop <= 0);
    }
  }, []);

  // Use route data from localStorage
  const deliveryLocation = routeData?.deliveryLocation || '';
  const stops = routeData?.stops || [];
  const category = routeData?.category || cart[0]?.category || 'food';
  const storeDistanceKm = useMemo(() => {
    const storeLocation = routeData?.storeLocation;
    const deliveryCoords = routeData?.deliveryCoords;
    if (
      deliveryCoords?.lat == null ||
      deliveryCoords?.lng == null ||
      storeLocation?.lat == null ||
      storeLocation?.lng == null
    ) {
      return null;
    }
    return haversineDistanceKm(deliveryCoords.lat, deliveryCoords.lng, storeLocation.lat, storeLocation.lng);
  }, [
    routeData?.deliveryCoords?.lat,
    routeData?.deliveryCoords?.lng,
    routeData?.storeLocation?.lat,
    routeData?.storeLocation?.lng,
  ]);

  // Determine service type based on category
  // food, clothes, market, and small shops use 'courier'; hardware uses 'delivery'
  const totalKg = getTotalKgExact();
  const serviceType = category === 'hardware' || totalKg > 200 ? 'delivery' : 'courier';

  // CART IS THE SINGLE SOURCE OF TRUTH
  const totalItemCount = useMemo(() => cart.length, [cart.length]);

  // Food subtotal from cart
  const foodSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  }, [cart]);

  // Load delivery options from backend
  const loadDeliveryOptions = useCallback(async () => {
    setIsLoading(true);
    setError('');

    // Get store location from route data - REAL COORDINATES ONLY
    const storeLocation = routeData?.storeLocation || { lat: null, lng: null };
    const storeAddress = routeData?.storeAddress || cart[0]?.storeAddress || '';
    const deliveryCoords = routeData?.deliveryCoords || { lat: null, lng: null };

    // Require real store coordinates - no fallbacks
    if (!storeLocation?.lat || !storeLocation?.lng) {
      setError('Store location not available. Please try again.');
      setIsLoading(false);
      return;
    }

    // Require real delivery coordinates - no coordinate offset hacks
    if (!deliveryCoords?.lat || !deliveryCoords?.lng) {
      setError('Delivery address coordinates missing. Please re-enter the delivery address.');
      setIsLoading(false);
      return;
    }

    try {
      const kgRange = getKgRange();

      // Build stops array with their real coordinates from routeData
      const stopsPayload = (routeData?.stops || [])
        .filter((s: any) => s.address)
        .map((s: any) => ({
          address: s.address,
          lat: s.lat ?? 0,
          lng: s.lng ?? 0,
        }));

      const payload: Record<string, unknown> = {
        pickup: storeAddress || 'Store',
        destination: deliveryLocation || 'Destination',
        stops: stopsPayload,
        pickupLat: storeLocation.lat,
        pickupLng: storeLocation.lng,
        dropLat: deliveryCoords.lat,
        dropLng: deliveryCoords.lng,
        serviceType: serviceType,
        category,
        kg: kgRange,
        totalKg,
        items: cart.map(item => ({ id: item.id, name: item.name, unit: item.unit ?? null, kg: item.kg ?? 0 })),
        storeId: routeData?.storeId || cart[0]?.storeId || '',
        storeName: routeData?.storeName || cart[0]?.storeName || '',
        storeDistanceKm,
        customerLat: latitude,
        customerLng: longitude,
        storeCategory: category,
      };

      console.log('[v0] Sending delivery payload:', payload);

      const response = await apiPost<{ data?: BackendRideOption[] }>('/getRideOptions', payload);
      
      console.log('[v0] Delivery options response:', response);
      
      const options = response?.data || response || [];
      const optionsArray = Array.isArray(options) ? options : [];
      
      // Filter options by service type before setting state
      const filteredOptions = filterOptionsByService(optionsArray, serviceType)
        .filter(option => option.tooHeavy !== true);

      // Enrich each option with dispatchService and vehicleCategory
      const enrichedOptions = filteredOptions.map(opt => enrichRideOption(opt, serviceType));

      setDeliveryOptions(enrichedOptions);
      if (!enrichedOptions.some(option => option.enabled)) {
        console.warn('[delivery] no enabled vehicle', { pickupLat: storeLocation.lat, pickupLng: storeLocation.lng, totalKg, serviceType });
      }

      // Auto-select first enabled vehicle
      const firstEnabled = enrichedOptions.find((x: BackendRideOption) => x.enabled);
      if (firstEnabled) {
        setSelectedOption(firstEnabled);
        setRoutePolyline(firstEnabled?.encodedPolyline ?? null);
      }
    } catch (err) {
      console.error('[v0] Failed to load delivery options:', err);
      setError('Failed to load delivery options');
    } finally {
      setIsLoading(false);
    }
  }, [routeData, cart, deliveryLocation, stops, serviceType, category, getKgRange, latitude, longitude, totalKg, storeDistanceKm]);

  // Re-fetch on every navigation to this page so the backend is called fresh
  // each time (e.g. returning after changing the delivery address or stops).
  useEffect(() => {
    loadDeliveryOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, routeData?.storeLocation, routeData?.deliveryCoords]);

  // Keep the drawn route polyline in sync with the currently selected option
  useEffect(() => {
    setRoutePolyline(selectedOption?.encodedPolyline ?? null);
  }, [selectedOption]);

  // Retry function
  const handleRetry = useCallback(() => {
    loadDeliveryOptions();
  }, [loadDeliveryOptions]);

  // Redirect if no route data or cart
  useEffect(() => {
    if (!routeData || cart.length === 0) {
      console.log('No route data or empty cart, redirecting to shop');
      navigate('/shop', { replace: true });
    }
  }, [routeData, cart.length, navigate]);

  // Get sorted delivery options - recommended first, then by filter criteria
  const getSortedOptions = (): BackendRideOption[] => {
    // Standard preserves the backend's order; alternate tabs sort with recommended first.
    let sorted = selectedFilter === 'standard'
      ? [...deliveryOptions]
      : sortOptionsWithRecommendedFirst(deliveryOptions);

    if (selectedFilter === 'faster') {
      sorted.sort((a, b) => {
        // Recommended still comes first
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        return a.eta - b.eta;
      });
    } else if (selectedFilter === 'cheaper') {
      sorted.sort((a, b) => {
        // Recommended still comes first
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        if (a.enabled && !b.enabled) return -1;
        if (!a.enabled && b.enabled) return 1;
        return a.price - b.price;
      });
    }

    return sorted;
  };

  const sortedOptions = getSortedOptions();

  // Calculate discounted price
  const getDiscountedPrice = (price: number): number => {
    return Math.round(price * (1 - PROMO_DISCOUNT / 100));
  };

  // Get delivery fee (discounted price from selected option)
  const deliveryFee = selectedOption ? getDiscountedPrice(selectedOption.price) : 0;
  const total = foodSubtotal + deliveryFee;

  // Handle drag on the drag handle only
  const handleDrag = useCallback((_event: any, info: PanInfo) => {
    const windowHeight = window.innerHeight;
    const deltaVh = (-info.delta.y / windowHeight) * 100;
    const newVh = rawPanelVh.get() + deltaVh;
    rawPanelVh.set(Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, newVh)));
  }, [rawPanelVh]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((_event: any, info: PanInfo) => {
    setIsDragging(false);
    const velocity = -info.velocity.y;

    if (Math.abs(velocity) > 600) {
      rawPanelVh.set(velocity > 0 ? PANEL_MAX_HEIGHT : PANEL_MIN_HEIGHT);
    } else {
      const currentVh = rawPanelVh.get();
      if (currentVh > SNAP_THRESHOLD) {
        rawPanelVh.set(PANEL_MAX_HEIGHT);
      } else {
        rawPanelVh.set(PANEL_MIN_HEIGHT);
      }
    }
  }, [rawPanelVh]);

  const handleContentTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isScrolledToTop) {
      e.stopPropagation();
    }
  }, [isScrolledToTop]);

  const handleClose = () => {
    const updatedData = {
      ...routeData,
      timestamp: Date.now()
    };
    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(updatedData));
    navigate(-1);
  };

  const handleAddStop = () => {
    const updatedData = {
      ...routeData,
      timestamp: Date.now()
    };
    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(updatedData));
    navigate(-1);
  };

  const handleAddressClick = () => {
    const updatedData = {
      ...routeData,
      timestamp: Date.now()
    };
    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(updatedData));
    navigate(-1);
  };

  const handleSelectMode = () => {
    if (!routeData || !selectedOption?.enabled) {
      return;
    }

    const storeId = routeData.storeId || cart[0]?.storeId || '';
    const storeName = routeData.storeName || cart[0]?.storeName || '';
    const storeAddress = routeData.storeAddress || cart[0]?.storeAddress || '';
    const storeLocation = routeData.storeLocation || { lat: null, lng: null };
    const deliveryCoords = routeData?.deliveryCoords;

    // For delivery flows the "pickup" is the store and the "destination" is the
    // customer's delivery address. Pass the route polyline + both endpoints so
    // ConfirmOrder (and later WaitingForDriver) can draw the route map.
    const pickupCoords = storeLocation?.lat && storeLocation?.lng
      ? { lat: storeLocation.lat, lng: storeLocation.lng }
      : undefined;
    const destinationCoords = deliveryCoords?.lat && deliveryCoords?.lng
      ? { lat: deliveryCoords.lat, lng: deliveryCoords.lng }
      : undefined;
navigate('/confirm-order', {
    state: {
        orderType: 'delivery',
        type: category,
        // Pass serviceType explicitly so ConfirmOrder doesn't have to infer it
        serviceType: serviceType,
        // Route data for the map (ConfirmOrder reads these top-level fields)
        encodedPolyline: routePolyline ?? undefined,
        pickupCoords,
        destinationCoords,
        orderData: {
          // Mirror the route data inside orderData so WaitingForDriver can read it
          encodedPolyline: routePolyline ?? undefined,
          pickupCoords,
          destinationCoords,
          deliveryMode: {
            id: selectedOption.category,
            label: selectedOption.title,
            time: `${selectedOption.eta} min`,
            description: `Delivery vehicle`,
            deliveryFee: deliveryFee,
            originalFee: selectedOption.price
          },
          // CRITICAL: Pass all backend metadata correctly
          dispatchService: selectedOption.dispatchService,
          vehicleCategory: selectedOption.vehicleCategory,
          selectedVehicle: selectedOption.category,
          pricingCategory: selectedOption.pricingCategory,
          // Store info
          storeId: storeId,
          storeName: storeName,
          storeAddress: storeAddress,
          storeLocation: storeLocation,
          storeImage: routeData.storeImage || '',
          category,
          storeCategory: category,
          totalKg,
          kg: getKgRange(),
          customerLat: latitude,
          customerLng: longitude,
          storeDistanceKm,
          destinationAddress: routeData.deliveryLocation || 'Destination',
          stops: stops || [],
          items: cart,
          subtotal: foodSubtotal,
          deliveryFee: deliveryFee,
          totalPrice: total
        }
      }
    });
  };

  const handleCashClick = () => {
    console.log('Cash payment clicked');
  };

  const handleScheduleClick = () => {
    console.log('Schedule clicked');
  };

  const getAddressDisplay = () => {
    const mainAddress = deliveryLocation || 'Current Location';
    const stopsText = stops.length > 0 ? ` +${stops.length} stop${stops.length > 1 ? 's' : ''}` : '';
    return `${mainAddress}${stopsText}`;
  };

  // Get icon config for a delivery option using unified config
  const getIconConfig = (categoryKey: string) => {
    return getVehicleConfig(categoryKey);
  };

  // Format ETA
  const formatEta = (etaMinutes: number, enabled: boolean): string => {
    if (!enabled) return 'No drivers';
    return `${etaMinutes} min`;
  };

  const hasOptions = deliveryOptions.length > 0;

  // Build map markers. The store keeps its own pin (it is not a pickup/dropoff
  // pin). The destination is represented by the polyline's Arrive-by card, so we
  // do NOT add a dropoff marker.
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    const storeLocation = routeData?.storeLocation;
    
    if (storeLocation?.lat && storeLocation?.lng) {
      markers.push({
        id: 'store',
        type: 'store',
        lat: storeLocation.lat,
        lng: storeLocation.lng
      });
    }
    
    if (latitude != null && longitude != null) {
    markers.unshift({
      id: 'current-location',
      type: 'currentLocation',
      lat: latitude,
      lng: longitude
    });
  }

  return [...markers, ...nearbyDrivers];
  }, [routeData, nearbyDrivers, latitude, longitude]);

  // Calculate arrival time
  const getArrivalTime = useCallback(() => {
    if (!selectedOption?.eta) return null;
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + (selectedOption.eta + 10) * 60000);
    return arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [selectedOption]);

  return (
    <div className="fixed inset-0 bg-gray-100 overflow-hidden">
      {/* Real MapLibre Map Background */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={routeData?.storeLocation?.lat && routeData?.storeLocation?.lng 
            ? { lat: routeData.storeLocation.lat, lng: routeData.storeLocation.lng } 
            : LUSAKA_DEFAULT}
          zoom={locationEditMode ? 16 : 13}
          markers={mapMarkers}
          polyline={routePolyline ?? undefined}
          pickupEta={selectedOption?.enabled ? selectedOption.eta : undefined}
          arrivalTime={selectedOption?.enabled ? getArrivalTime() || undefined : undefined}
          fitBounds={!locationEditMode && mapMarkers.length > 1}
          onMapIdle={(center) => locationEditMode && setLocationCenter(center)}
          onArrivalCardClick={() => {
            const delivery = routeData?.deliveryCoords || routeData?.destinationCoords || LUSAKA_DEFAULT;
            setLocationEditMode('destination');
            setLocationCenter({ lat: delivery.lat, lng: delivery.lng });
          }}
          focusCoordinate={locationEditMode ? locationCenter : null}
          className="w-full h-full"
        />
        {locationEditMode && locationCenter && (
          <LocationPickerOverlay
            mode={locationEditMode}
            initialCoordinate={locationCenter}
  initialAddress={locationEditAddress || (locationEditMode === 'pickup' ? (routeData?.storeAddress || cart[0]?.storeAddress || 'Store') : deliveryLocation)}
  onAddressChange={setLocationEditAddress}
  onCancel={() => { setLocationEditMode(null); setLocationEditAddress(''); }}
            onConfirm={(coordinate, address) => {
              const nextRouteData = {
                ...routeData,
                storeLocation: locationEditMode === 'pickup' ? coordinate : routeData?.storeLocation,
                storeAddress: locationEditMode === 'pickup' ? address : routeData?.storeAddress,
                deliveryCoords: locationEditMode === 'destination' ? coordinate : routeData?.deliveryCoords,
                deliveryLocation: locationEditMode === 'destination' ? address : deliveryLocation,
                timestamp: Date.now(),
              };
              localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(nextRouteData));
              setRouteData(nextRouteData);
              setLocationEditMode(null);
              setLocationEditAddress('');
            }}
          />
        )}
      </div>

      <motion.div
        className="absolute top-4 left-4 right-4 z-30"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>

          <button
            onClick={handleAddressClick}
            className="flex-1 text-left min-w-0"
          >
            <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {getAddressDisplay()}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-sm font-medium text-gray-700">
                  Delivery ({totalItemCount} item{totalItemCount !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleAddStop}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <Plus size={20} className="text-gray-700" />
          </button>
        </div>
      </motion.div>

      <motion.div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-20 flex flex-col will-change-transform"
        style={{
          height: panelHeightStyle,
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: locationEditMode ? '100%' : 0, opacity: locationEditMode ? 0 : 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {PROMO_ACTIVE && (
          <motion.div
            className="bg-[#5B2EFF] text-white w-full px-4 py-3 flex items-center justify-center gap-2 rounded-t-3xl flex-shrink-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-white">✓</span>
            <span className="font-medium text-sm">{PROMO_TEXT}</span>
            <ChevronDown size={16} />
          </motion.div>
        )}

        <motion.div
          className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileTap={{ scale: 1.02 }}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="px-4 flex-shrink-0 overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                opacity: { duration: 0.2 }
              }}
            >
              <div className="flex gap-3 mb-4">
                <motion.button
                  onClick={() => setSelectedFilter('standard')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                    selectedFilter === 'standard'
                      ? 'bg-white border-2 border-[#5B2EFF] text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Standard
                </motion.button>
                <motion.button
                  onClick={() => setSelectedFilter('faster')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                    selectedFilter === 'faster'
                      ? 'bg-white border-2 border-[#5B2EFF] text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Faster
                </motion.button>
                <motion.button
                  onClick={() => setSelectedFilter('cheaper')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                    selectedFilter === 'cheaper'
                      ? 'bg-white border-2 border-[#5B2EFF] text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.15, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cheaper
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: isDragging ? 'none' : 'pan-y'
          }}
          onScroll={handleScroll}
          onTouchStart={handleContentTouchStart}
        >
          {/* SKELETON LOADING STATE */}
          {isLoading ? (
            <div className="space-y-3 mb-6">
              {[0, 1, 2, 3].map((index) => (
                <DeliverySkeletonCard key={index} index={index} />
              ))}
            </div>
          ) : error ? (
            /* ERROK STATE */
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <motion.button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-[#5B2EFF] text-white rounded-full font-medium"
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw size={16} />
                Retry
              </motion.button>
            </div>
          ) : !deliveryOptions.some(option => option.enabled) ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-gray-600 text-center mb-2">No drivers near {routeData?.storeName || cart[0]?.storeName || 'the store'} right now. Try again in a few minutes.</p>
              <motion.button
                onClick={handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-[#5B2EFF] text-white rounded-full font-medium"
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw size={16} />
                Refresh
              </motion.button>
            </div>
          ) : (
            /* SUCCESS STATE - Render backend response */
            <div className="space-y-3 mb-6">
              {sortedOptions.map((option, index) => {
                const discountedPrice = getDiscountedPrice(option.price);
                const iconConfig = getIconConfig(option.category);
                const cardTotal = foodSubtotal + discountedPrice;
                
                return (
                  <motion.button
                    key={option.category}
                    onClick={() => option.enabled && setSelectedOption(option)}
                    disabled={!option.enabled}
                    className={`w-full p-4 rounded-2xl border-2 transition-all ${
                      !option.enabled 
                        ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 opacity-60 cursor-not-allowed'
                        : selectedOption?.category === option.category
                          ? 'border-[#5B2EFF] bg-[#5B2EFF]/10 dark:bg-[#5B2EFF]/20'
                          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileTap={{ scale: option.enabled ? 0.98 : 1 }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 flex items-center justify-center rounded-xl overflow-hidden">
                        <img 
                          src={iconConfig.image} 
                          alt={option.title}
                          className="w-14 h-14 object-contain"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white">{option.title}</h3>
                            {option.recommended && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 dark:text-white">K {cardTotal}</p>
                            <p className="text-sm text-gray-500">K {discountedPrice} fee</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={`text-sm ${option.enabled ? 'text-gray-600' : 'text-orange-600'}`}>
                            {formatEta(option.eta, option.enabled)}
                          </span>
                          {/* Seats hidden for delivery services - only show capacity info if needed */}
                        </div>
                        {!option.enabled && (
                          <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                            NO DRIVERS
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
              <p className="text-xs text-gray-500">Total weight about {totalKg} kg</p>
            </div>
          )}

          {/* Price breakdown - only show when we have data */}
          {!isLoading && hasOptions && (
            <motion.div
              className="bg-white border-t border-gray-200 pt-4 space-y-3 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Item subtotal</span>
                <span className="font-medium text-gray-900">K {foodSubtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery fee</span>
                <span className="font-medium text-gray-900">K {deliveryFee}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900 dark:text-white">K {total}</span>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative bg-gray-100 dark:bg-gray-800 rounded-full p-1 flex items-center flex-shrink-0">
              <motion.div
                className="absolute top-1 bottom-1 left-1 bg-white dark:bg-gray-600 rounded-full shadow-md"
                animate={{
                  width: 40,
                  x: profileToggle === 'personal' ? 0 : 40
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              />
              <button
                onClick={() => setProfileToggle('personal')}
                className="relative z-10 w-10 h-10 flex items-center justify-center"
              >
                <User size={18} className={profileToggle === 'personal' ? 'text-gray-900 dark:text-white' : 'text-gray-400'} />
              </button>
              <button
                onClick={() => setProfileToggle('business')}
                className="relative z-10 w-10 h-10 flex items-center justify-center"
              >
                <Briefcase size={18} className={profileToggle === 'business' ? 'text-gray-900 dark:text-white' : 'text-gray-400'} />
              </button>
            </div>

            <motion.button
              onClick={handleCashClick}
              className="py-2 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1 flex-shrink-0 text-sm"
              whileTap={{ scale: 0.95 }}
            >
              Cash
              <ChevronDown size={14} />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              onClick={handleScheduleClick}
              className="w-12 h-12 bg-[#5B2EFF] text-white rounded-2xl flex items-center justify-center hover:bg-[#4A24D9] transition-colors shadow-lg flex-shrink-0"
              whileTap={{ scale: 0.95 }}
            >
              <Calendar size={20} />
            </motion.button>
          </div>

          <motion.button
            onClick={handleSelectMode}
            disabled={!selectedOption?.enabled || isLoading}
            className={`w-full py-3 rounded-2xl font-bold text-base transition-colors shadow-lg ${
              !selectedOption?.enabled || isLoading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-[#5B2EFF] text-white hover:bg-[#4A24D9]'
            }`}
            whileTap={{ scale: (!selectedOption?.enabled || isLoading) ? 1 : 0.98 }}
          >
            {isLoading 
              ? 'Loading...'
              : selectedOption?.enabled 
                ? `Select ${selectedOption.title}`
                : 'No drivers available'
            }
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
