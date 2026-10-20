import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, CreditCard as Edit, Phone, Share, CreditCard, X, MessageCircle } from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import { DraggablePanel } from '../components/DraggablePanel';
import { ScrollableSection } from '../components/ScrollableSection';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { MessagePanel } from '../components/MessagePanel';
import { RatingModal } from '../components/RatingModal';
import { firebaseService } from '../services/firebaseService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { useFirebaseRide } from '../hooks/useFirebaseRide';
import { useMessageContext } from '../contexts/MessageContext';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { listenToDriverLocation } from '../services/trackingService';
import { trimPolylineFromPosition } from '../utils/polylineUtils';
import { soundManager } from '../utils/notificationSound';
import { usePreventBack } from '../hooks/usePreventBack';
import { useGeolocation } from '../hooks/useGeolocation';
import { 
  subscribeToOrder, 
  cancelOrder, 
  markOrderRated,
  Order, 
  OrderStatus
} from '../services/orderService';

const getAddressText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'address' in value) {
    const address = (value as { address?: unknown }).address;
    return typeof address === 'string' ? address : '';
  }
  return '';
};

interface DriverComingProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  currentRideId: string | null;
  onBack: () => void;
}

interface DriverInfo {
  id: string;
  name: string;
  rating: number;
  plateNumber: string;
  carModel: string;
  carImage?: string; // Vehicle photo
  vehicleColor?: string; // Registered vehicle color for icon lookup
  eta: string;
  photo: string;
  phone?: string; // Driver phone for call button
  location: {
    latitude: number;
    longitude: number;
  };
}

// Driver Card Skeleton Component - matches SelectRide skeleton style
const DriverCardSkeleton: React.FC = () => (
  <motion.div
    className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center space-x-4">
      {/* Profile picture skeleton */}
      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      
      <div className="flex-1 space-y-2">
        {/* Plate number skeleton */}
        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        {/* Car model skeleton */}
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        {/* Driver name skeleton */}
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      
      {/* Car image skeleton */}
      <div className="w-16 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
    </div>
  </motion.div>
);

export const DriverComing: React.FC<DriverComingProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  currentRideId,
  onBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUserProfile(auth.currentUser?.uid);
  const { latitude, longitude } = useGeolocation();
  const { currentRide } = useFirebaseRide(currentRideId);
  const { unreadMessageCount, markMessagesAsRead } = useMessageContext();

  const { 
    orderType = 'ride', 
    orderId: stateOrderId,
    requestId, 
    orderData = {}
  } = location.state || {};
  
  const isFood = orderType === 'food' || orderType === 'small_shop' || orderType === 'market';
  const isService = orderType === 'service' || ['package', 'towing', 'truck'].includes(orderType);
  const isRide = orderType === 'ride';
  const orderId = stateOrderId || requestId || currentRideId;

  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [isDriverLoading, setIsDriverLoading] = useState<boolean>(true);
  const [rideStatus, setRideStatus] = useState<string>('accepted');
  const [statusText, setStatusText] = useState('');
  const [activeTripPolyline, setActiveTripPolyline] = useState<string | null>(null);
  const [trimmedPolyline, setTrimmedPolyline] = useState<string | null>(null);
  const fullPolylineRef = useRef<string | null>(null);
  const [showRouteOverlay, setShowRouteOverlay] = useState(false);
  const [showArrivalAlert, setShowArrivalAlert] = useState(false);
  const [hasShownArrivalAlert, setHasShownArrivalAlert] = useState(false);
  const [isMessagePanelOpen, setIsMessagePanelOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  usePreventBack(!['completed', 'cancelled', 'delivered'].includes(rideStatus) || isRatingModalOpen);
  const [foodOrderDetails, setFoodOrderDetails] = useState<any>(null);
  const [serviceRequestDetails, setServiceRequestDetails] = useState<any>(null);
  const [firestoreRideData, setFirestoreRideData] = useState<any>(null);
  const gpsListenerRef = useRef<(() => void) | null>(null);
  const orderListenerRef = useRef<(() => void) | null>(null);
  // Guards setting driver info exactly once without putting driverInfo in the
  // effect deps (which would tear down and re-subscribe the listeners mid-flight).
  const driverInfoSetRef = useRef(false);

  const finalDestination = getAddressText(isService || isFood
    ? orderData.destinationAddress
    : (orderData.destination || orderData.destinationLocation?.address || destination));
  
  const finalPickup = getAddressText(isService || isFood
    ? orderData.pickupAddress
    : (orderData.pickup || orderData.pickupLocation?.address || pickup));
  
  const finalStops = isService 
    ? (firestoreRideData?.stops || orderData.stops || []) 
    : isFood 
      ? (firestoreRideData?.stops || orderData.stops || []) 
      : (firestoreRideData?.stops || orderData.stops || stops);
  
  const finalCarType = isService 
    ? orderData.vehicleClass 
    : isFood 
      ? orderData.deliveryMode?.label 
      : (orderData.rideName || carType);
  
  const finalPrice = isService
    ? orderData.pricing?.basePrice
    : isFood
      ? (firestoreRideData?.total ?? orderData.totalPrice)
      : (firestoreRideData?.total ?? orderData.total ?? price);
  
  // Run once on mount to seed the polyline/ETA from the initial orderData so the
  // driver-to-pickup route draws immediately, before subscribeToOrder fires.
  useEffect(() => {
    const data = orderData as any;
    if (!data) return;

    const initialStatus = data.status || 'accepted';

    if (initialStatus === 'accepted' || initialStatus === 'arriving') {
      const etaMins = data.driverToPickupEtaMinutes;
      if (typeof etaMins === 'number') {
        setStatusText(`${etaMins} min${etaMins !== 1 ? 's' : ''}`);
      }

      const poly = data.driverToPickupPolyline;
      if (poly) {
        fullPolylineRef.current = poly;
        setActiveTripPolyline(poly);
        setTrimmedPolyline(poly);
        setShowRouteOverlay(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty deps — runs only on mount

  // Listen to order status changes from unified orders collection
  useEffect(() => {
    if (!orderId) return;

    // Subscribe to unified orders collection
    const unsubscribe = subscribeToOrder(orderId, (order) => {
      if (!order) return;

      setFirestoreRideData(order);
      const newStatus = order.status;
      setRideStatus(newStatus);

      // Update driver info from order document when driver data is available
      // IMPORTANT: Driver info MUST come from the order document, NOT from querying drivers collection
      // The backend injects driver snapshot into the order document after driver acceptance
      // Fields from Firestore driverSnapshot: firstName, profilePicture, rating, brand, model, color, plateNumber, carImage
      const driverFromOrder = (order as any).driverSnapshot || (order as any).driver;
      if (driverFromOrder && !driverInfoSetRef.current) {
        driverInfoSetRef.current = true;
        const mappedDriver: DriverInfo = {
          id: driverFromOrder.uid || driverFromOrder.id || '',
          // Use firstName from Firestore
          name: driverFromOrder.firstName || driverFromOrder.name || 'Driver',
          rating: driverFromOrder.rating || 0,
          // Use plateNumber directly from Firestore
          plateNumber: driverFromOrder.plateNumber || driverFromOrder.vehicle?.plateNumber || driverFromOrder.licensePlate || '',
          // Build car model from Firestore fields: color, brand, model
          carModel: driverFromOrder.color && driverFromOrder.brand && driverFromOrder.model
            ? `${driverFromOrder.color} ${driverFromOrder.brand} ${driverFromOrder.model}`.trim()
            : driverFromOrder.vehicle 
              ? `${driverFromOrder.vehicle.color || ''} ${driverFromOrder.vehicle.brand || ''} ${driverFromOrder.vehicle.model || ''}`.trim()
              : `${driverFromOrder.vehicleColor || ''} - ${driverFromOrder.vehicleMake || ''} ${driverFromOrder.vehicleModel || ''}`.trim(),
          // Use carImage from Firestore for vehicle photo
          carImage: driverFromOrder.carImage || driverFromOrder.vehicleImage || '',
          vehicleColor: driverFromOrder.color || driverFromOrder.vehicle?.color || '',
          eta: '',
          // Use profilePicture from Firestore
          photo: driverFromOrder.profilePicture || driverFromOrder.profileImage || driverFromOrder.photo || '',
          phone: driverFromOrder.phone || '',
          location: {
            latitude: driverFromOrder.location?.lat ?? (latitude ?? -15.3875),
            longitude: driverFromOrder.location?.lng ?? (longitude ?? 28.3228)
          }
        };
        setDriverInfo(mappedDriver);
        setIsDriverLoading(false);
      }
      // DO NOT query drivers collection directly - driver info must come from order document

      // Helper: ensure the RTDB GPS listener is running for the animated vehicle + polyline trimming
      // The order document has a flat `driverId` field — use it first. driverSnapshot has no uid.
      const driverIdForGps = (
        (order as any).driverId ||
        (order as any).driverSnapshot?.uid ||
        (order as any).driverSnapshot?.id ||
        (order as any).driver?.id
      );
      const ensureGpsListener = () => {
        if (driverIdForGps && !gpsListenerRef.current) {
          gpsListenerRef.current = listenToDriverLocation(driverIdForGps, (driverLoc) => {
            // Always move the animated vehicle
            setDriverLocation({ lat: driverLoc.lat, lng: driverLoc.lng });
            // Trim the polyline from the current position forward
            if (fullPolylineRef.current) {
              const trimmed = trimPolylineFromPosition(fullPolylineRef.current, driverLoc.lat, driverLoc.lng);
              setTrimmedPolyline(trimmed || null);
            }
          });
        }
      };

      // ── ACCEPTED: driver → pickup ──────────────────────────────────────
      if (newStatus === 'accepted' || newStatus === 'arriving') {
        // 1. ETA from Firestore driverToPickupEtaMinutes
        const etaMins = (order as any).driverToPickupEtaMinutes;
        if (typeof etaMins === 'number') {
          setStatusText(`${etaMins} min${etaMins !== 1 ? 's' : ''}`);
        }

        // 2. Polyline: driverToPickupPolyline
        const poly = (order as any).driverToPickupPolyline;
        if (poly && poly !== fullPolylineRef.current) {
          fullPolylineRef.current = poly;
          setActiveTripPolyline(poly);
          setTrimmedPolyline(poly);
          setShowRouteOverlay(true);
        }

        // 3. Live GPS for animated vehicle + trimming
        ensureGpsListener();
      }

      // ── ARRIVED: hide pickup polyline, vehicle stays ───────────────────
      if (newStatus === 'arrived') {
        setTrimmedPolyline(null);
        setActiveTripPolyline(null);
        fullPolylineRef.current = null;
        setShowRouteOverlay(false);
        setStatusText('Your driver has arrived');

        if (!hasShownArrivalAlert) {
          const alreadyNotified = localStorage.getItem(`arrival_notified_${orderId}`);
          if (!alreadyNotified) {
            setShowArrivalAlert(true);
            setHasShownArrivalAlert(true);
            soundManager.play('arrived');
            localStorage.setItem(`arrival_notified_${orderId}`, 'true');
            setTimeout(() => setShowArrivalAlert(false), 5000);
          }
        }
      }

      // ── STARTED: driver → destination ──────────────────────────────────
      if (newStatus === 'started') {
        // 1. New polyline from the "polyline" field
        const tripPoly = (order as any).polyline;
        if (tripPoly) {
          fullPolylineRef.current = tripPoly;
          setActiveTripPolyline(tripPoly);
          setTrimmedPolyline(tripPoly);
          setShowRouteOverlay(true);
        }

        // 2. ETA from Firestore durationMinutes
        const dur = (order as any).durationMinutes;
        if (typeof dur === 'number') {
          setStatusText(`${dur} min${dur !== 1 ? 's' : ''}`);
        }

        // 3. Ensure GPS listener still running
        ensureGpsListener();
      }

      // ── COMPLETED: clear everything, show rating ───────────────────────
      if (newStatus === 'completed') {
        setTrimmedPolyline(null);
        setActiveTripPolyline(null);
        fullPolylineRef.current = null;
        setShowRouteOverlay(false);
        setStatusText('');
        if (gpsListenerRef.current) {
          gpsListenerRef.current();
          gpsListenerRef.current = null;
        }
        setTimeout(() => setIsRatingModalOpen(true), 2000);
        return;
      }

      // ── CANCELLED ──────────────────────────────────────────────────────
      if (newStatus === 'cancelled') {
        setTrimmedPolyline(null);
        setActiveTripPolyline(null);
        fullPolylineRef.current = null;
        setShowRouteOverlay(false);
        setStatusText('Ride cancelled');
        if (gpsListenerRef.current) {
          gpsListenerRef.current();
          gpsListenerRef.current = null;
        }
        return;
      }
    });

    orderListenerRef.current = unsubscribe;

    return () => {
      if (orderListenerRef.current) {
        orderListenerRef.current();
        orderListenerRef.current = null;
      }
      if (gpsListenerRef.current) {
        gpsListenerRef.current();
        gpsListenerRef.current = null;
      }
    };
  }, [orderId, hasShownArrivalAlert]);

  const handleMessageDriver = async () => {
    setIsMessagePanelOpen(true);
    await markMessagesAsRead();
  };

  const handleOpenAddStop = () => {
    navigate('/your-route', {
      state: {
        serviceType: 'ride',
        editMode: true,
        returnTo: 'driver-coming',
        orderId,
        orderType,
        pickup: finalPickup,
        destination: finalDestination,
        stops: (finalStops || []).map((stop: any) => typeof stop === 'string' ? stop : stop.address || ''),
        stopCoords: (finalStops || []).map((stop: any) => stop && typeof stop === 'object' && stop.lat && stop.lng ? { lat: stop.lat, lng: stop.lng } : null),
        pickupCoords: orderData.pickupCoords || (orderData.pickupLat && orderData.pickupLng ? { lat: orderData.pickupLat, lng: orderData.pickupLng } : null),
        destinationCoords: orderData.destinationCoords || (orderData.dropLat && orderData.dropLng ? { lat: orderData.dropLat, lng: orderData.dropLng } : null),
        driverId: firestoreRideData?.driverId || orderData.driverId || null,
        orderData
      }
    });
  };

  const handleCancelClick = () => setShowCancelConfirmation(true);
  const handleWaitForDriver = () => setShowCancelConfirmation(false);

  const handleConfirmCancel = async () => {
    try {
      const orderIdToCancel = orderId || currentRide?.id || currentRideId;
      if (!orderIdToCancel) return;

      // Use unified cancel order service
      await cancelOrder(orderIdToCancel, 'User cancelled ride');
      
      setShowCancelConfirmation(false);

      // Clear localStorage
      localStorage.removeItem('currentOrderId');
      localStorage.removeItem('currentOrderType');

      navigate('/what-went-wrong', {
        state: {
          orderId: orderIdToCancel,
          userId: profile?.id || 'user123',
          userName: profile?.name || 'Unknown User',
          destination: finalDestination,
          pickup: finalPickup,
          stops: finalStops,
          carType: finalCarType,
          price: finalPrice
        }
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      setShowCancelConfirmation(false);
    }
  };

  const isMessageDisabled = rideStatus === 'pending' || rideStatus === 'completed';
  const hasAssignedDriver = Boolean(driverInfo?.id || firestoreRideData?.driverId || orderData.driverId);
  const { callState, startCall } = useCall();
  const [isCallConfirmOpen, setIsCallConfirmOpen] = useState(false);

  const handleCall = () => {
    if (hasAssignedDriver && !isMessageDisabled && callState === 'idle') setIsCallConfirmOpen(true);
  };

  // Driver location state for live tracking
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Update driver location when it comes from GPS listener
  useEffect(() => {
    if (driverInfo?.location) {
      setDriverLocation({
        lat: driverInfo.location.latitude,
        lng: driverInfo.location.longitude
      });
    }
  }, [driverInfo?.location]);

  // Build map markers - stops only.
  // No pickup bubble at the polyline start — the animated vehicle marks that position.
  // The dropoff/destination diamond marker is intentionally NOT rendered during
  // accepted/started/arrived/completed — only the animated vehicle and route line show.
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Add stop markers
    const stops = finalStops || [];
    stops.forEach((stop: any, index: number) => {
      if (stop.lat && stop.lng) {
        markers.push({
          id: `stop-${index}`,
          type: 'stop',
          lat: stop.lat,
          lng: stop.lng,
          label: `${index + 1}`
        });
      }
    });
    
    return markers;
  }, [finalStops]);

  // Calculate ETA and arrival time
  const getArrivalTime = useCallback(() => {
    if (!statusText.includes('min')) return null;
    const match = statusText.match(/(\d+)\s*min/);
    if (match) {
      const eta = parseInt(match[1]);
      const now = new Date();
      const arrivalDate = new Date(now.getTime() + eta * 60000);
      return arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return null;
  }, [statusText]);

  // Extract ETA minutes from status text
  const getEtaMinutes = useCallback(() => {
    const match = statusText.match(/(\d+)\s*min/);
    return match ? parseInt(match[1]) : undefined;
  }, [statusText]);
  void getEtaMinutes;

  return (
    <div className="min-h-screen relative overflow-hidden dark:bg-gray-900">
      {/* Real MapLibre Map with live driver tracking */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={driverLocation || (orderData?.pickupCoords?.lat && orderData?.pickupCoords?.lng 
            ? { lat: orderData.pickupCoords.lat, lng: orderData.pickupCoords.lng } 
            : latitude != null && longitude != null
    ? { lat: latitude, lng: longitude }
    : { lat: -15.3875, lng: 28.3228 })}
          zoom={14}
          markers={mapMarkers}
          driverPosition={driverLocation || undefined}
          vehicleType={(firestoreRideData as any)?.vehicleType || (firestoreRideData as any)?.deliveryMode?.type || (orderData as any)?.deliveryMode?.type || 'car'}
          vehicleColor={driverInfo?.vehicleColor}
          polyline={showRouteOverlay ? (trimmedPolyline ?? undefined) : undefined}
          arrivalTime={showRouteOverlay ? (getArrivalTime() || undefined) : undefined}
          fitBounds={mapMarkers.length > 1}
          className="w-full h-full"
        />
      </div>

      {/* Arrival Alert */}
      <AnimatePresence>
        {showArrivalAlert && (
          <motion.div
            className="fixed top-4 left-4 right-4 bg-[#5B2EFF] text-white p-4 rounded-xl shadow-lg z-50"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
          >
            <p className="font-semibold text-center">Your driver has arrived!</p>
          </motion.div>
        )}
      </AnimatePresence>

      <DraggablePanel initialHeight={500} maxHeight={680} minHeight={175}>
        <div className="space-y-6 pb-6">
          <motion.div className="text-center pt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {statusText
                ? (rideStatus === 'accepted' || rideStatus === 'arriving' || rideStatus === 'started'
                    ? `${statusText} away`
                    : statusText)
                : ''}
            </h2>
          </motion.div>

          {/* Driver Card - with skeleton loading and slide-up animation */}
          <AnimatePresence mode="wait">
            {isDriverLoading ? (
              <DriverCardSkeleton key="skeleton" />
            ) : driverInfo && (
              <motion.div 
                key="driver-card"
                className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4" 
                initial={{ opacity: 0, y: 50, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              >
                <div className="flex items-center space-x-4">
                  {/* Driver Profile Picture - from profilePicture field */}
                  <div className="relative">
                    {driverInfo.photo ? (
                      <img 
                        src={driverInfo.photo} 
                        alt={driverInfo.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                        {driverInfo.name?.charAt(0) || '?'}
                      </div>
                    )}
                    {/* Star Rating Badge */}
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-700 rounded-full px-1.5 py-0.5 shadow-md flex items-center space-x-0.5">
                      <span className="text-amber-500 text-xs">&#9733;</span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{driverInfo.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    {/* Plate Number */}
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{driverInfo.plateNumber || 'Unknown'}</h3>
                    {/* Car Model (color brand model) */}
                    <p className="text-gray-600 dark:text-gray-300">{driverInfo.carModel || 'Vehicle'}</p>
                    {/* Driver Name (firstName) */}
                    <p className="text-gray-900 dark:text-white font-medium">{driverInfo.name || 'Driver'}</p>
                  </div>
                  
                  {/* Car Image - from carImage field */}
                  {driverInfo.carImage ? (
                    <img 
                      src={driverInfo.carImage} 
                      alt="Vehicle"
                      className="w-16 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="text-3xl">🚗</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cancel + Message Row */}
          <motion.div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              {rideStatus !== 'arrived' && rideStatus !== 'in_progress' && rideStatus !== 'started' && (
                <button onClick={handleCancelClick} className="text-sm text-red-600 font-medium hover:text-red-700 transition-colors">
                  Cancel ride
                </button>
              )}
              <motion.p
                animate={{
                  scale: [1, 1.05, 1],
                  textShadow: [
                    '0 0 0px rgba(147, 51, 234, 0)',
                    '0 0 20px rgba(147, 51, 234, 0.8)',
                    '0 0 0px rgba(147, 51, 234, 0)'
                  ]
                }}
                transition={{ repeat: Infinity, duration: 1, repeatDelay: 4 }}
                className={`text-sm text-gray-700 dark:text-gray-300 text-center ${rideStatus === 'arrived' || rideStatus === 'in_progress' || rideStatus === 'started' ? 'flex-1 text-left' : 'flex-1'}`}
              >
                Message or call your driver
              </motion.p>
              <motion.button
                onClick={handleMessageDriver}
                disabled={isMessageDisabled}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                className={`relative p-2 rounded-full transition-colors ${isMessageDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                <MessageCircle className={`${isMessageDisabled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`} size={24} />
                {unreadMessageCount > 0 && !isMessageDisabled && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-lg"
                  >
                    {unreadMessageCount}
                  </motion.span>
                )}
              </motion.button>
              <motion.button
                onClick={handleCall}
                disabled={!hasAssignedDriver || isMessageDisabled || callState !== 'idle'}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                aria-label={callState === 'calling' ? 'Calling driver' : callState === 'in-call' ? 'In call' : 'Call driver'}
                className={`flex items-center gap-1 rounded-full px-2 py-2 text-xs transition-colors ${!hasAssignedDriver || isMessageDisabled || callState !== 'idle' ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >
                <Phone className={callState === 'calling' || callState === 'in-call' ? 'animate-pulse text-emerald-600' : 'text-gray-700 dark:text-gray-300'} size={24} />
                <span>{callState === 'calling' ? 'Calling…' : callState === 'in-call' ? 'In call' : 'Call driver'}</span>
              </motion.button>
            </div>
          </motion.div>


          <ScrollableSection maxHeight="max-h-[420px]">
            <div className="space-y-6 pb-4">
              {isFood ? (
                <>
                  {/* Food Order Details */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Food Items</h3>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(foodOrderDetails?.items || orderData?.items || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                            <span className="font-medium text-gray-900 dark:text-white">K {item.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Delivery route</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-[#5B2EFF] rounded-full"></div>
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{finalPickup}</span>
                      </div>

                      {finalStops.length > 0 && finalStops.map((stop: any, index: number) => (
                        <div key={index} className="flex items-center space-x-3 ml-6">
                          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                          <span className="flex-1 text-gray-700 dark:text-gray-300">{getAddressText(stop)}</span>
                        </div>
                      ))}

                      <div className="flex items-center space-x-3">
                        <MapPin className="text-[#5B2EFF]" size={12} />
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{finalDestination}</span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment summary</h3>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Food subtotal</span>
                        <span className="font-medium text-gray-900 dark:text-white">K {foodOrderDetails?.foodSubtotal || orderData?.foodSubtotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Delivery fee</span>
                        <span className="font-medium text-gray-900 dark:text-white">K {foodOrderDetails?.fee || foodOrderDetails?.deliveryFee || orderData?.fee || 0}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">K {finalPrice}</span>
                      </div>
                    </div>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Ride Details */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">My route</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-[#5B2EFF] rounded-full"></div>
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{finalPickup}</span>
                        <Edit className="text-gray-400 dark:text-gray-500" size={16} />
                      </div>

                      {finalStops.map((stop: any, index: number) => (
                        <div key={index} className="flex items-center space-x-3 ml-6">
                          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                          <span className="flex-1 text-gray-700 dark:text-gray-300">{getAddressText(stop) || 'Address not specified'}</span>
                          <Edit className="text-gray-400 dark:text-gray-500" size={16} />
                        </div>
                      ))}

                      {rideStatus !== 'arrived' && rideStatus !== 'in_progress' && rideStatus !== 'started' && (
                        <button
                          type="button"
                          onClick={handleOpenAddStop}
                          className="flex items-center space-x-3 ml-6 w-full text-left"
                        >
                          <Plus className="text-[#5B2EFF]" size={16} />
                          <span className="text-[#5B2EFF] font-medium">Add stop</span>
                        </button>
                      )}

                      <div className="flex items-center space-x-3">
                        <MapPin className="text-[#5B2EFF]" size={12} />
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{finalDestination}</span>
                        <Edit className="text-gray-400 dark:text-gray-500" size={16} />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment method</h3>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CreditCard className="text-purple-600" size={20} />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Cash</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Fare - {finalCarType}</p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">K {finalPrice}</span>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </ScrollableSection>
        </div>
      </DraggablePanel>

  <AnimatePresence>
    {isCallConfirmOpen && (
      <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-xs w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Call your driver?</h3>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setIsCallConfirmOpen(false); if (orderId) void startCall(orderId); }} className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white">Call Driver</button>
            <button onClick={() => setIsCallConfirmOpen(false)} className="flex-1 rounded-xl bg-red-100 px-4 py-3 font-semibold text-red-700">Cancel</button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Cancel Confirmation Modal */}
  <AnimatePresence>
        {showCancelConfirmation && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 max-w-sm w-full relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <button
                onClick={handleWaitForDriver}
                className="absolute top-4 right-4 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300"
              >
                <X size={20} className="text-gray-600" />
              </button>

              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-4xl">👨🏽‍💼</span>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Are you sure?</h3>
              <p className="text-gray-600 text-center mb-8 leading-relaxed">
                Do you really want to cancel the ride? Rebooking may not get you there faster.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmCancel}
                  className="w-full bg-red-500 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-red-600"
                >
                  Cancel ride
                </button>
                <button
                  onClick={handleWaitForDriver}
                  className="w-full bg-gray-100 text-gray-800 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200"
                >
                  Wait for driver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MessagePanel
        isOpen={isMessagePanelOpen}
        onClose={() => setIsMessagePanelOpen(false)}
        rideId={orderId || ''}
        currentUserId={auth.currentUser?.uid || profile?.id || ''}
        currentUserName={profile?.name || 'Client'}
        driverId={firestoreRideData?.driverId || (isFood ? foodOrderDetails?.driverId : currentRide?.driverId) || 'driver123'}
        driverName={driverInfo?.name || 'Driver'}
        isRideActive
      />

      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => {
          setIsRatingModalOpen(false);
          localStorage.removeItem('currentOrderId');
          localStorage.removeItem('currentOrderType');
          navigate('/', { replace: true });
        }}
        onSubmitted={() => orderId ? markOrderRated(orderId) : undefined}
        path={isFood ? 'store_delivery' : 'direct_trip'}
        driverName={driverInfo?.name || 'Driver'}
        driverPhoto={driverInfo?.photo || ''}
        driverId={driverInfo?.id || firestoreRideData?.driverId || ''}
        orderId={orderId || ''}
        storeName={isFood ? (foodOrderDetails?.storeName || orderData?.storeName || 'Store') : undefined}
        storeImage={isFood ? (foodOrderDetails?.storeImage || orderData?.storeImage || '') : undefined}
        storeId={isFood ? (foodOrderDetails?.storeId || orderData?.storeId || '') : undefined}
      />
    </div>
  );
};
