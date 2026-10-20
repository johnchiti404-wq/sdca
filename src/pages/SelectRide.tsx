import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { X, Plus, Calendar, Users, User, Briefcase, ChevronDown, RefreshCw } from 'lucide-react';
import { PromoDetailsPanel } from '../components/PromoDetailsPanel';
import { useActiveOrder } from '../hooks/useActiveOrder';
import { apiPost } from '../config/api';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { LocationPickerOverlay, LocationEditMode, LocationCoordinate, formatCoordinateAddress } from '../components/LocationPickerOverlay';
import { useNearbyDrivers, LUSAKA_DEFAULT } from '../hooks/useNearbyDrivers';
import {
  BackendRideOption,
  getVehicleConfig,
  filterOptionsByService,
  enrichRideOption,
  sortOptionsWithRecommendedFirst
} from '../config/vehicleConfig';

interface SelectRideProps {
  destination: string;
  pickup: string;
  stops: string[];
  onBack: () => void;
  onSelectRide: (carType: string, price: number) => void;
}

type FilterTab = 'recommended' | 'faster' | 'cheaper';

const PANEL_MIN_VH = 36;
const PANEL_MAX_VH = 85;
const EXPAND_THRESHOLD_VH = 55;

// Skeleton Card Component - Uber/Bolt style
const RideSkeletonCard: React.FC<{ index: number }> = ({ index }) => (
  <motion.div
    className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    <div className="flex items-center space-x-4">
      {/* Car image placeholder */}
      <div className="w-12 h-12 rounded-xl bg-gray-200 animate-pulse" />
      
      <div className="flex-1">
        {/* Title line */}
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        
        {/* Subtitle line */}
        <div className="flex items-center space-x-4">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  </motion.div>
);

export const SelectRide: React.FC<SelectRideProps> = ({
  destination,
  pickup,
  stops,
  onBack,
  onSelectRide
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { order: activeOrder } = useActiveOrder();
  const isRideActive = Boolean(activeOrder);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [locationEditMode, setLocationEditMode] = useState<LocationEditMode | null>(null);
  const [locationCenter, setLocationCenter] = useState<LocationCoordinate | null>(null);
  const [locationEditAddress, setLocationEditAddress] = useState('');

  // Read navigation state to determine service type
  const { 
    serviceType = 'ride', 
    extraOption,
    category,
    kg,
    pickupCoords,
    destinationCoords,
    pickup: navPickup,
    destination: navDestination,
    stops: navStops = []
  } = location.state || {};

  const [pickupOverride, setPickupOverride] = useState<{ address: string; coords: LocationCoordinate } | null>(null);
  const [destinationOverride, setDestinationOverride] = useState<{ address: string; coords: LocationCoordinate } | null>(null);
  const effectivePickupCoords = pickupOverride?.coords ?? pickupCoords;
  const effectivePickup = pickupOverride?.address ?? (navPickup || pickup);
  const effectiveDestinationCoords = destinationOverride?.coords ?? destinationCoords;
  const effectiveDestination = destinationOverride?.address ?? (navDestination || destination);

  // SINGLE SOURCE OF TRUTH - local state for ride options from backend
  const [rideOptions, setRideOptions] = useState<BackendRideOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRide, setSelectedRide] = useState<BackendRideOption | null>(null);
  const [routePolyline, setRoutePolyline] = useState<string | null>(null);
  const nearbyDrivers = useNearbyDrivers(effectivePickupCoords?.lat ?? null, effectivePickupCoords?.lng ?? null);

  // Promo discount (30%)
  const promoDiscount = 30;

  // Load ride options from backend - SINGLE API CALL
  const loadRideOptions = useCallback(async () => {
    setIsLoading(true);
    setError('');

    // REAL COORDINATES ONLY - no fallbacks
    // Backend will reject if coordinates are missing
    if (!effectivePickupCoords?.lat || !effectivePickupCoords?.lng || !effectiveDestinationCoords?.lat || !effectiveDestinationCoords?.lng) {
      setError('Missing coordinates. Please select valid addresses.');
      setIsLoading(false);
      return;
    }

    try {
      // Build stops array with their real coordinates from navigation state
      const navStopCoords = location.state?.stopCoords || [];
      const navStopsList = location.state?.stops || [];
      const stopsPayload = navStopsList.map((address: string, index: number) => ({
        address,
        lat: navStopCoords[index]?.lat ?? 0,
        lng: navStopCoords[index]?.lng ?? 0,
      }));

      const payload: Record<string, unknown> = {
        pickup: effectivePickup,
        destination: effectiveDestination,
        stops: stopsPayload,
        pickupLat: effectivePickupCoords.lat,
        pickupLng: effectivePickupCoords.lng,
        dropLat: effectiveDestinationCoords.lat,
        dropLng: effectiveDestinationCoords.lng
      };

      // Service type payloads based on navigation state
      if (serviceType === 'ride') {
        payload.serviceType = 'ride';
      } else if (serviceType === 'courier') {
        // Courier service for food, clothes, or package deliveries
        payload.serviceType = 'courier';
        payload.category = category || 'package'; // 'food', 'clothes', or 'package'
        payload.kg = kg || extraOption || '0-5kg';
      } else if (serviceType === 'package') {
        // Legacy package service - map to courier
        payload.serviceType = 'courier';
        payload.category = 'package';
        payload.kg = kg || extraOption || '0-5kg';
      } else if (serviceType === 'delivery') {
        // Delivery truck service for hardware/heavy items
        payload.serviceType = 'delivery';
        payload.category = category || 'hardware';
        payload.kg = kg || extraOption || '0-5kg';
      } else if (serviceType === 'towing') {
        payload.serviceType = 'towing';
        payload.vehicleType = extraOption || 'SUV';
      } else if (serviceType === 'truck') {
        payload.serviceType = 'delivery_truck';
        payload.deliveryType = extraOption || 'farm produce';
      }

      console.log('[v0] Sending ride payload:', payload);

      const response = await apiPost<{ data?: BackendRideOption[] }>('/getRideOptions', payload);
      
      console.log('[v0] Ride options response:', response);
      
      const options = response?.data || response || [];
      
      // Handle array response directly or wrapped in data property
      const optionsArray = Array.isArray(options) ? options : [];
      
      // Filter options by service type before setting state
      const filteredOptions = filterOptionsByService(optionsArray, serviceType);

      // Enrich each option with dispatchService and vehicleCategory
      const enrichedOptions = filteredOptions.map(opt => enrichRideOption(opt, serviceType));

      setRideOptions(enrichedOptions);

      // Auto-select first enabled vehicle
      const firstEnabled = enrichedOptions.find((x: BackendRideOption) => x.enabled);
      if (firstEnabled) {
        setSelectedRide(firstEnabled);
        setRoutePolyline(firstEnabled?.encodedPolyline ?? null);
      }
    } catch (err) {
      console.error('[v0] Failed to load ride options:', err);
      setError('Failed to load rides');
    } finally {
      setIsLoading(false);
    }
  }, [effectivePickup, effectiveDestination, effectivePickupCoords, effectiveDestinationCoords, navStops, stops, serviceType, extraOption, category, kg, location.state]);

  // Re-fetch on every navigation to this page (e.g. returning from YourRoute
  // after changing an address or adding a stop). location.key changes on each
  // navigation, so the backend is called fresh each time.
  useEffect(() => {
    loadRideOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, pickupOverride, destinationOverride]);

  // Keep the drawn route polyline in sync with the currently selected ride
  useEffect(() => {
    setRoutePolyline(selectedRide?.encodedPolyline ?? null);
  }, [selectedRide]);

  // Retry function that fetches again
  const handleRetry = useCallback(() => {
    loadRideOptions();
  }, [loadRideOptions]);

  const [showPromoDetails, setShowPromoDetails] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('recommended');
  const [profileToggle, setProfileToggle] = useState<'personal' | 'business'>('personal');

  // Spring-driven panel height (in vh)
  const rawPanelVh = useMotionValue(PANEL_MIN_VH);
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
      setIsExpanded(latest > EXPAND_THRESHOLD_VH);
    });
    return unsubscribe;
  }, [springPanelVh]);

  const promo = {
    discount: promoDiscount,
    ridesLeft: 5,
    maxPerRide: 80,
    expiryDate: 'December 29, 2025',
    paymentMethods: 'Apple Pay, Bolt balance, Google Pay, Card, Family, Cash',
    rideCategories: 'XL, Women for Women, Economy, Bolt, Comfort, Lite, Premium, XXL, Send, Business Send (excludes Scheduled Rides)',
    rideAreas: 'Gauteng'
  };

  const handleDrag = useCallback((_event: unknown, info: PanInfo) => {
    const windowHeight = window.innerHeight;
    const deltaVh = (-info.delta.y / windowHeight) * 100;
    const newVh = rawPanelVh.get() + deltaVh;
    rawPanelVh.set(Math.max(PANEL_MIN_VH, Math.min(PANEL_MAX_VH, newVh)));
  }, [rawPanelVh]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    setIsDragging(false);
    const velocity = -info.velocity.y;

    if (Math.abs(velocity) > 600) {
      rawPanelVh.set(velocity > 0 ? PANEL_MAX_VH : PANEL_MIN_VH);
    } else {
      const currentVh = rawPanelVh.get();
      if (currentVh > EXPAND_THRESHOLD_VH) {
        rawPanelVh.set(PANEL_MAX_VH);
      } else {
        rawPanelVh.set(PANEL_MIN_VH);
      }
    }
  }, [rawPanelVh]);

  // Determine if this is a ride service (shows seats) or delivery service (hides seats)
  const isRideService = serviceType === 'ride';

  // Sort ride options based on filter - recommended first, then by filter criteria
  const getSortedRideOptions = (): BackendRideOption[] => {
    // Start with recommended sorting
    let sorted = sortOptionsWithRecommendedFirst(rideOptions);

    if (selectedFilter === 'faster') {
      sorted.sort((a, b) => {
        // Recommended still comes first
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        // Available rides before unavailable
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

  const sortedRideOptions = getSortedRideOptions();

  const getAddressDisplay = () => {
    const actualStops = navStops.length > 0 ? navStops : stops;
    const stopsText = actualStops.length > 0 ? ` +${actualStops.length} stop${actualStops.length > 1 ? 's' : ''}` : '';
    const actualPickup = effectivePickup;
    const actualDestination = effectiveDestination;
    return `${actualPickup} → ${actualDestination}${stopsText}`;
  };

  // Handle ride selection and navigation to confirm
  const handleSelectRide = () => {
    if (isRideActive) {
      alert('You already have an active ride.');
      return;
    }

    if (selectedRide && selectedRide.enabled) {
      // Apply promo discount to price
      const discountedPrice = Math.round(selectedRide.price * (1 - promoDiscount / 100));
      
      // CRITICAL: Pass serviceType to ConfirmOrder so it knows which flow this is
      // For package/truck/towing, serviceType MUST be passed, NOT orderType: 'ride'
      const isServiceFlow = serviceType === 'package' || serviceType === 'towing' || serviceType === 'truck';
      
      // Navigate to confirm order with all ride/service data
      navigate('/confirm-order', {
        state: {
          // For service flows, pass orderType as the serviceType so ConfirmOrder can identify the flow
          orderType: isServiceFlow ? serviceType : 'ride',
          // ALWAYS pass serviceType explicitly so ConfirmOrder doesn't have to infer
          serviceType: serviceType,
          // For service flows, pass vehicle data instead of rideData
          ...(isServiceFlow ? {
            vehicle: {
              id: selectedRide.category,
              name: selectedRide.title,
              title: selectedRide.title,
              price: discountedPrice,
              eta: selectedRide.eta,
              dispatchService: selectedRide.dispatchService,
              vehicleCategory: selectedRide.vehicleCategory,
            },
            extraSelection: extraOption,
          } : {
            rideData: {
              pricingId: selectedRide.category,
              name: selectedRide.title,
              estimatedPrice: discountedPrice,
              originalPrice: selectedRide.price,
              eta: `${selectedRide.eta} min`,
              vehicleCategory: selectedRide.vehicleCategory,
              seats: selectedRide.seats,
              dispatchService: selectedRide.dispatchService,
              selectedVehicle: selectedRide.category,
            },
          }),
          pickupAddress: effectivePickup,
          destinationAddress: effectiveDestination,
          stops: navStops.length > 0 ? navStops : stops,
          pickupCoords: effectivePickupCoords,
          destinationCoords: effectiveDestinationCoords,
          stopCoords: location.state?.stopCoords || [],
          encodedPolyline: selectedRide?.encodedPolyline ?? null
        }
      });
    }
  };

  // Get icon config for a ride option using unified config
  const getRideIconConfig = (category: string) => {
    return getVehicleConfig(category);
  };

  // Format ETA - backend already returns minutes
  const formatEta = (etaMinutes: number, enabled: boolean): string => {
    if (!enabled) return 'No drivers';
    return `${etaMinutes} min`;
  };

  // Calculate discounted price
  const getDiscountedPrice = (price: number): number => {
    return Math.round(price * (1 - promoDiscount / 100));
  };

  const hasOptions = rideOptions.length > 0;

  // Build map markers. Pickup/dropoff are NOT added as markers — the polyline's
  // own ETA bubble (start) and Arrive-by card (end) represent those endpoints.
  // Only intermediate stops get a marker, for multi-stop rides.
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    const stopCoords = location.state?.stopCoords || [];
    stopCoords.forEach((stop: { lat?: number; lng?: number }, index: number) => {
      if (stop?.lat && stop?.lng) {
        markers.push({
          id: `stop-${index}`,
          type: 'stop',
          lat: stop.lat,
          lng: stop.lng,
          label: `${index + 1}`
        });
      }
    });
    if (effectivePickupCoords?.lat != null && effectivePickupCoords?.lng != null) {
    markers.unshift({
      id: 'current-location',
      type: 'currentLocation',
      lat: effectivePickupCoords.lat,
      lng: effectivePickupCoords.lng
    });
  }
  return markers;
  }, [location.state?.stopCoords, effectivePickupCoords]);

  // Calculate arrival time based on ETA
  const getArrivalTime = useCallback(() => {
    if (!selectedRide?.eta) return null;
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + (selectedRide.eta + 15) * 60000);
    return arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [selectedRide]);

  return (
    <div className="fixed inset-0 bg-gray-100 overflow-hidden">
      {/* Real MapLibre Map Background */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={effectivePickupCoords?.lat && effectivePickupCoords?.lng 
            ? { lat: effectivePickupCoords.lat, lng: effectivePickupCoords.lng } 
            : LUSAKA_DEFAULT}
          zoom={locationEditMode ? 16 : 13}
  markers={[...mapMarkers, ...nearbyDrivers]}
  polyline={routePolyline ?? undefined}
          pickupEta={selectedRide?.enabled ? selectedRide.eta : undefined}
          arrivalTime={selectedRide?.enabled ? getArrivalTime() || undefined : undefined}
          fitBounds={!locationEditMode && mapMarkers.length > 1}
          onMapIdle={(center) => locationEditMode && setLocationCenter(center)}
          onEtaBubbleClick={() => {
            setLocationEditMode('pickup');
            setLocationCenter(effectivePickupCoords || LUSAKA_DEFAULT);
          }}
          onArrivalCardClick={() => {
            setLocationEditMode('destination');
            setLocationCenter(effectiveDestinationCoords || effectivePickupCoords || LUSAKA_DEFAULT);
          }}
          focusCoordinate={locationEditMode ? locationCenter : null}
          className="w-full h-full"
        />
        <AnimatePresence>
        {locationEditMode && (
          <motion.div key="location-picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <LocationPickerOverlay
            mode={locationEditMode}
            initialCoordinate={locationCenter || effectivePickupCoords || effectiveDestinationCoords || LUSAKA_DEFAULT}
  initialAddress={locationEditAddress || (locationEditMode === 'pickup' ? effectivePickup : effectiveDestination)}
  onAddressChange={setLocationEditAddress}
  onCancel={() => { setLocationEditMode(null); setLocationEditAddress(''); }}
            onConfirm={(coordinate, address) => {
              const nextAddress = address || formatCoordinateAddress(coordinate);
              if (locationEditMode === 'pickup') {
                setPickupOverride({ address: nextAddress, coords: coordinate });
              } else if (locationEditMode === 'destination') {
                setDestinationOverride({ address: nextAddress, coords: coordinate });
              }
              setLocationEditMode(null);
              setLocationEditAddress('');
            }}
          />
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <motion.div
        className="absolute top-4 left-4 right-4 z-30"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>

          <button
            onClick={() => {
              setLocationEditMode('destination');
            setLocationCenter(effectiveDestinationCoords || effectivePickupCoords || LUSAKA_DEFAULT);
            }}
            className="flex-1 text-left min-w-0"
          >
            <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {getAddressDisplay()}
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/your-route', {
              state: {
                highlightAddStop: true,
                prefilledDestination: effectiveDestination,
                prefilledPickup: effectivePickup,
                prefilledPickupCoords: effectivePickupCoords,
                prefilledDestinationCoords: effectiveDestinationCoords,
                prefilledStops: navStops.length > 0 ? navStops : stops,
                prefilledStopCoords: location.state?.stopCoords || []
              }
            })}
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
        <motion.div
          className="bg-[#5B2EFF] text-white w-full px-4 py-3 flex items-center justify-center gap-2 rounded-t-3xl flex-shrink-0 cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowPromoDetails(true)}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-white">✓</span>
          <span className="font-medium text-sm">{promo.discount}% promo applied</span>
          <ChevronDown size={16} />
        </motion.div>

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
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
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
                  onClick={() => setSelectedFilter('recommended')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                    selectedFilter === 'recommended'
                      ? 'bg-white border-2 border-[#5B2EFF] text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Recommended
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
        >
          {/* SKELETON LOADING - Uber/Bolt style animated placeholders */}
          {isLoading ? (
            <div className="space-y-3 mb-6">
              {[0, 1, 2, 3, 4].map((index) => (
                <RideSkeletonCard key={index} index={index} />
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
          ) : !hasOptions ? (
            /* EMPTY STATE */
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-gray-600 text-center mb-2">No vehicles available nearby</p>
              <p className="text-gray-400 text-sm text-center mb-4">Try again in a moment</p>
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
            /* SUCCESS STATE - Render backend response directly */
            <div className="space-y-3 mb-6">
              {sortedRideOptions.map((option, index) => {
                const discountedPrice = getDiscountedPrice(option.price);
                const iconConfig = getRideIconConfig(option.category);
                
                return (
                  <motion.button
                    key={option.category}
                    onClick={() => option.enabled && setSelectedRide(option)}
                    disabled={!option.enabled}
                    className={`w-full p-4 rounded-2xl border-2 transition-all ${
                      !option.enabled 
                        ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 opacity-60 cursor-not-allowed'
                        : selectedRide?.category === option.category
                          ? 'border-[#5B2EFF] bg-[#5B2EFF]/10 dark:bg-[#5B2EFF]/20'
                          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileTap={{ scale: option.enabled ? 0.98 : 1 }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 flex items-center justify-center overflow-hidden">
                        <img 
                          src={iconConfig.image} 
                          alt={option.title}
                          className="w-14 h-14 object-contain drop-shadow-sm"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white">{option.title}</h3>
                            {option.recommended && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 dark:text-white">K {discountedPrice}</p>
                            {discountedPrice !== option.price && (
                              <p className="text-sm text-gray-500 line-through">K {option.price}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className={`text-sm ${option.enabled ? 'text-gray-600' : 'text-orange-600'}`}>
                            {formatEta(option.eta, option.enabled)}
                          </span>
                          {/* Only show seats for ride services, not delivery services */}
                          {isRideService && (
                            <div className="flex items-center space-x-1">
                              <Users size={14} className="text-gray-500" />
                              <span className="text-sm text-gray-600">{option.seats}</span>
                            </div>
                          )}
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
            </div>
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
              onClick={() => console.log('Cash payment clicked')}
              className="py-2 px-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-1 flex-shrink-0 text-sm"
              whileTap={{ scale: 0.95 }}
            >
              Cash
              <ChevronDown size={14} />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              onClick={() => navigate('/schedule-ride')}
              className="w-12 h-12 bg-[#5B2EFF] text-white rounded-2xl flex items-center justify-center hover:bg-[#4A25D9] transition-colors shadow-lg flex-shrink-0"
              whileTap={{ scale: 0.95 }}
            >
              <Calendar size={20} />
            </motion.button>
          </div>

          <motion.button
            onClick={handleSelectRide}
            disabled={isRideActive || !selectedRide?.enabled || isLoading}
            className={`w-full py-3 rounded-2xl font-bold text-base transition-colors shadow-lg ${
              isRideActive || !selectedRide?.enabled || isLoading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-[#5B2EFF] text-white hover:bg-[#4A25D9]'
            }`}
            whileTap={{ scale: (isRideActive || !selectedRide?.enabled || isLoading) ? 1 : 0.98 }}
          >
            {isRideActive 
              ? 'Ride Active' 
              : isLoading
                ? 'Loading...'
                : selectedRide?.enabled 
                  ? `Select ${selectedRide.title}`
                  : 'No drivers available'
            }
          </motion.button>
          {isRideActive && (
            <p className="text-gray-500 text-center text-sm mt-2">
              Finish current ride before booking another
            </p>
          )}
        </div>
      </motion.div>

      <PromoDetailsPanel
        isOpen={showPromoDetails}
        onClose={() => setShowPromoDetails(false)}
        promo={promo}
      />
    </div>
  );
};
