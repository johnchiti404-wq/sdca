import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, MapPin, Star, Package, Home, Navigation } from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { RatingModal } from '../components/RatingModal';
import { MessagePanel } from '../components/MessagePanel';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { listenToDriverLocation } from '../services/trackingService';
import { trimPolylineFromPosition } from '../utils/polylineUtils';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { useMessageContext } from '../contexts/MessageContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { auth } from '../config/firebase';
import { soundManager } from '../utils/notificationSound';
import { usePreventBack } from '../hooks/usePreventBack';
import { useGeolocation } from '../hooks/useGeolocation';
import { markOrderRated } from '../services/orderService';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface DriverData {
  id?: string;
  uid?: string;
  name: string;
  rating: number;
  phone: string;
  profileImage?: string;
  photo?: string;
  carImage?: string; // Vehicle photo from carImage field
  vehicle?: {
    brand: string;
    model: string;
    color: string;
    plateNumber: string;
    type: string;
  };
  // Direct fields from Firestore (alternative to nested vehicle object)
  brand?: string;
  model?: string;
  color?: string;
  plateNumber?: string;
  // Legacy fields for backward compatibility
  vehicleType?: string;
}

// Driver Card Skeleton Component - matches SelectRide skeleton style
const DriverCardSkeleton: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center justify-between"
  >
    <div className="flex items-center space-x-4">
      {/* Profile picture skeleton */}
      <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      
      <div className="space-y-2">
        {/* Driver name + rating skeleton */}
        <div className="flex items-center space-x-2">
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
        {/* Car model skeleton */}
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        {/* Plate number skeleton */}
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
      </div>
    </div>
    
    {/* Action buttons skeleton */}
    <div className="flex space-x-2">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    </div>
  </motion.div>
);

interface DriverLocation {
  lat: number;
  lng: number;
}

interface AddressValue {
  address?: string;
  lat?: number;
  lng?: number;
}

const getAddressText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'address' in value) {
    const address = (value as AddressValue).address;
    return typeof address === 'string' ? address : '';
  }
  return '';
};

interface OrderData {
  id?: string;
  storeName?: string;
  storeAddress?: string | AddressValue;
  storeImage?: string;
  storeId?: string;
  items?: OrderItem[];
  subtotal?: number;
  fee?: number;
  total?: number;
  status?: string;
  driverStatus?: string;
  driverId?: string | null;
  driverLocation?: DriverLocation;
  destinationAddress?: string | AddressValue;
  destinationLocation?: { lat: number; lng: number };
  storeLocation?: { lat: number; lng: number };
  stops?: Array<{ address: string; items?: OrderItem[] }>;
  type?: string;
}

const getStatusText = (status: string, stops?: any[]): { title: string; subtitle: string } => {
  // STRICT CHECK: Handle "arrived" status explicitly
  if (status === 'arrived') {
    return {
      title: 'Order Arrived',
      subtitle: 'Your order has arrived'
    };
  }

  // STRICT CHECK: Handle "completed" status explicitly
  if (status === 'completed') {
    return {
      title: 'Order Completed',
      subtitle: 'Thank you for your order'
    };
  }

  const statusMessages: Record<string, { title: string; subtitle: string }> = {
    driver_assigned: { title: 'Driver is on the way to store', subtitle: 'Picking up your order' },
    on_the_way_to_store: { title: 'Driver is on the way to store', subtitle: 'Picking up your order' },
    at_store: { title: 'Driver arrived at store', subtitle: 'Collecting your items' },
    picked_up: { title: 'Order picked up', subtitle: 'On the way to you' },
    delivering: { title: 'On the way to you', subtitle: 'Almost there' },
    at_stop: { 
      title: stops && stops.length > 0 ? 'Driver heading to stop' : 'On the way to you', 
      subtitle: 'Delivering your order' 
    },
    delivered: { title: 'Order Delivered', subtitle: 'Enjoy your order' },
  };
  
  return statusMessages[status] || { title: 'Driver is on the way', subtitle: 'Tracking your delivery' };
};

export const LiveTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderData: initialOrderData } = location.state || {};
  const { clearCart } = useGlobalCart();
  const { profile } = useUserProfile(auth.currentUser?.uid);
  const { callState, formattedTime, startCall } = useCall();
  const { latitude, longitude } = useGeolocation();
  const { unreadMessageCount, markMessagesAsRead } = useMessageContext();

  const [orderData, setOrderData] = useState<OrderData>(initialOrderData || {});
  const [isMessagePanelOpen, setIsMessagePanelOpen] = useState(false);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [isDriverLoading, setIsDriverLoading] = useState<boolean>(true);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isCallConfirmOpen, setIsCallConfirmOpen] = useState(false);
  const [statusTitle, setStatusTitle] = useState<string>('Driver is on the way');
  const [statusSubtitle, setStatusSubtitle] = useState<string>('Tracking your delivery');
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [activePolyline, setActivePolyline] = useState<string | null>(null);
  usePreventBack(!['completed', 'cancelled', 'delivered'].includes(orderData.status || '') || showRatingModal);
  const [trimmedPolyline, setTrimmedPolyline] = useState<string | null>(null);
  const fullPolylineRef = useRef<string | null>(null);
  const [showRouteOverlay, setShowRouteOverlay] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const driverFromOrder = (orderData as any).driverSnapshot || (orderData as any).driver;
  const gpsListenerRef = useRef<(() => void) | null>(null);
  const previousStatusRef = useRef<string | undefined>(initialOrderData?.status);

  // Run once on mount to seed the polyline/ETA from initialOrderData so the
  // route draws immediately, before the first Firestore snapshot fires.
  useEffect(() => {
    const data = initialOrderData as any;
    if (!data) return;

    const s = data.status;
    const ds = data.driverStatus;

    const isDriverAssignedPhase =
      (s === 'driverassigned' || s === 'driver_assigned' || ds === 'assigned') &&
      s !== 'at_store' && s !== 'picked_up' && s !== 'delivered' && s !== 'completed';

    if (isDriverAssignedPhase) {
      const etaMins = data.driverToPickupEtaMinutes;
      if (typeof etaMins === 'number') setEtaMinutes(etaMins);

      const poly = data.driverToPickupPolyline;
      if (poly) {
        fullPolylineRef.current = poly;
        setActivePolyline(poly);
        setTrimmedPolyline(poly);
        setShowRouteOverlay(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty deps — runs only on mount

  useEffect(() => {
    const status = orderData.status;
    if (!status || status === previousStatusRef.current) return;

    const soundByStatus: Record<string, 'store' | 'picked' | 'delivered'> = {
      at_store: 'store',
      picked_up: 'picked',
      delivered: 'delivered',
    };
    const sound = soundByStatus[status];
    if (sound) soundManager.play(sound);

    previousStatusRef.current = status;
  }, [orderData.status]);

  // Listen to order document in real-time
  // IMPORTANT: Driver info MUST come from the order document's "driver" field
  // DO NOT query drivers collection directly
  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrderData;

        // Map flat pickupLat/pickupLng → storeLocation so the store marker renders.
        // The Firestore order document stores the store/pickup as flat fields, not a nested object.
        const pickupLat = (data as any).pickupLat;
        const pickupLng = (data as any).pickupLng;
        const normalized: OrderData = {
          ...data,
          id: orderId,
          // Preserve storeImage from initial data since Firestore doesn't store it
          storeImage: initialOrderData?.storeImage || (data as any).storeImage || '',
          storeName: data.storeName || initialOrderData?.storeName,
          storeId: data.storeId || initialOrderData?.storeId,
        };
        if (!normalized.storeLocation && typeof pickupLat === 'number' && typeof pickupLng === 'number') {
          normalized.storeLocation = { lat: pickupLat, lng: pickupLng };
        }
        // Map flat dropLat/dropLng → destinationLocation so the destination
        // marker renders and fitBounds has two points to frame the route.
        const dropLat = (data as any).dropLat;
        const dropLng = (data as any).dropLng;
        if (!normalized.destinationLocation && typeof dropLat === 'number' && typeof dropLng === 'number') {
          normalized.destinationLocation = { lat: dropLat, lng: dropLng };
        }
        setOrderData(normalized);
        
        // Update status text using the new format with title/subtitle
        const statusInfo = getStatusText(data.status || 'driver_assigned', data.stops);
        setStatusTitle(statusInfo.title);
        setStatusSubtitle(statusInfo.subtitle);

        // Update driver location from order document
        if (data.driverLocation) {
          setDriverLocation(data.driverLocation);
        }

        // IMPORTANT: Read driver info from the order document's "driverSnapshot" field
        // The backend injects a driver snapshot into the order document after driver acceptance
        // Fields from Firestore driverSnapshot: firstName, profilePicture, rating, brand, model, color, plateNumber, carImage
        // DO NOT query drivers collection directly
        const driverFromOrder = (data as any).driverSnapshot || (data as any).driver;
        if (driverFromOrder && !driverData) {
          setDriverData({
            id: driverFromOrder.uid || driverFromOrder.id || '',
            uid: driverFromOrder.uid || '',
            // Use firstName from Firestore
            name: driverFromOrder.firstName || driverFromOrder.name || 'Driver',
            rating: driverFromOrder.rating || 0,
            phone: driverFromOrder.phone || '',
            // Use profilePicture from Firestore
            profileImage: driverFromOrder.profilePicture || driverFromOrder.profileImage || '',
            // Use carImage from Firestore for vehicle photo
            carImage: driverFromOrder.carImage || driverFromOrder.vehicleImage || '',
            // Direct fields from Firestore
            brand: driverFromOrder.brand || '',
            model: driverFromOrder.model || '',
            color: driverFromOrder.color || '',
            plateNumber: driverFromOrder.plateNumber || '',
            // Also support nested vehicle object for backward compatibility
            vehicle: driverFromOrder.vehicle ? {
              brand: driverFromOrder.vehicle.brand || driverFromOrder.brand || '',
              model: driverFromOrder.vehicle.model || driverFromOrder.model || '',
              color: driverFromOrder.vehicle.color || driverFromOrder.color || '',
              plateNumber: driverFromOrder.vehicle.plateNumber || driverFromOrder.plateNumber || '',
              type: driverFromOrder.vehicle.type || ''
            } : {
              brand: driverFromOrder.brand || '',
              model: driverFromOrder.model || '',
              color: driverFromOrder.color || '',
              plateNumber: driverFromOrder.plateNumber || '',
              type: ''
            }
          });
          setIsDriverLoading(false);
        }

        const s = (data as any).status;
        const ds = (data as any).driverStatus;

        // Helper: ensure the RTDB GPS listener is running (animated vehicle + trimming)
        const driverIdForGps = (data as any).driverId || (data as any).driverSnapshot?.uid;
        const ensureGpsListener = () => {
          if (driverIdForGps && !gpsListenerRef.current) {
            gpsListenerRef.current = listenToDriverLocation(driverIdForGps, (loc) => {
              setDriverLocation({ lat: loc.lat, lng: loc.lng });
              if (fullPolylineRef.current) {
                const trimmed = trimPolylineFromPosition(fullPolylineRef.current, loc.lat, loc.lng);
                setTrimmedPolyline(trimmed || null);
              }
            });
          }
        };

        // ── DRIVER ASSIGNED: driver → store/pickup ───────────────────────
        if (
          (s === 'driverassigned' || s === 'driver_assigned' || ds === 'assigned') &&
          s !== 'at_store' && s !== 'picked_up' && s !== 'delivered' && s !== 'completed'
        ) {
          // 1. ETA from Firestore driverToPickupEtaMinutes
          const etaMins = (data as any).driverToPickupEtaMinutes;
          if (typeof etaMins === 'number') setEtaMinutes(etaMins);

          // 2. Polyline: driverToPickupPolyline
          const poly = (data as any).driverToPickupPolyline;
          if (poly && poly !== fullPolylineRef.current) {
            fullPolylineRef.current = poly;
            setActivePolyline(poly);
            setTrimmedPolyline(poly);
            setShowRouteOverlay(true);
          }

          // 3. Live GPS for animated vehicle + trimming
          ensureGpsListener();
        }

        // ── AT STORE: hide pickup polyline, vehicle stays ────────────────
        if (s === 'at_store') {
          setTrimmedPolyline(null);
          setActivePolyline(null);
          fullPolylineRef.current = null;
          setShowRouteOverlay(false);
          setEtaMinutes(null);
          setStatusTitle('Driver arrived at store');
          setStatusSubtitle('Collecting your items');
        }

        // ── PICKED UP: driver → destination ──────────────────────────────
        if (s === 'picked_up') {
          // 1. New polyline from the "polyline" field
          const tripPoly = (data as any).polyline;
          if (tripPoly) {
            fullPolylineRef.current = tripPoly;
            setActivePolyline(tripPoly);
            setTrimmedPolyline(tripPoly);
            setShowRouteOverlay(true);
          }

          // 2. ETA from Firestore durationMinutes
          const dur = (data as any).durationMinutes;
          if (typeof dur === 'number') setEtaMinutes(dur);

          setStatusTitle('Order picked up');
          setStatusSubtitle('On the way to you');

          // 3. Ensure GPS listener running
          ensureGpsListener();
        }

        // ── DELIVERED ────────────────────────────────────────────────────
        if (s === 'delivered') {
          setTrimmedPolyline(null);
          setActivePolyline(null);
          fullPolylineRef.current = null;
          setShowRouteOverlay(false);
          setEtaMinutes(null);
          setStatusTitle('Order Delivered');
          setStatusSubtitle('Enjoy your order');
          if (gpsListenerRef.current) { gpsListenerRef.current(); gpsListenerRef.current = null; }
          // Order finished — empty the global cart
          clearCart();
        }

        // ── ARRIVED ──────────────────────────────────────────────────────
        if (s === 'arrived') {
          setTrimmedPolyline(null);
          setShowRouteOverlay(false);
          setEtaMinutes(null);
        }

        // ── COMPLETED: clear everything, show rating ─────────────────────
        if (s === 'completed') {
          setTrimmedPolyline(null);
          setActivePolyline(null);
          fullPolylineRef.current = null;
          setShowRouteOverlay(false);
          setEtaMinutes(null);
          if (gpsListenerRef.current) { gpsListenerRef.current(); gpsListenerRef.current = null; }
          // Order finished — empty the global cart
          clearCart();
          setTimeout(() => setShowRatingModal(true), 1000);
        }

        // ── CANCELLED ────────────────────────────────────────────────────
        if (s === 'cancelled') {
          setTrimmedPolyline(null);
          setActivePolyline(null);
          fullPolylineRef.current = null;
          setShowRouteOverlay(false);
          setEtaMinutes(null);
          setStatusTitle('Order Cancelled');
          setStatusSubtitle('This order has been cancelled');
          if (gpsListenerRef.current) { gpsListenerRef.current(); gpsListenerRef.current = null; }
        }
      }
    });

    return () => {
      unsubscribe();
      if (gpsListenerRef.current) {
        gpsListenerRef.current();
        gpsListenerRef.current = null;
      }
    };
  }, [orderId, initialOrderData]);

  const handleCall = () => {
    if (driverData?.id || driverData?.uid || orderData.driverId) {
      setIsCallConfirmOpen(true);
    }
  };

  const handleMessage = async () => {
    setIsMessagePanelOpen(true);
    await markMessagesAsRead();
  };

  // Build map markers for store, destination, driver, and stops
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    
    // Store marker
    if (orderData.storeLocation?.lat && orderData.storeLocation?.lng) {
      markers.push({
        id: 'store',
        type: 'store',
        lat: orderData.storeLocation.lat,
        lng: orderData.storeLocation.lng
      });
    }
    
    // NOTE: The destination/dropoff (diamond) marker is intentionally NOT added
    // on the live tracking page. Only the backend-driven markers (store/pickup
    // and stops) should ever appear here, regardless of order status.

    // Stop markers
    const stops = orderData.stops || [];
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
  }, [orderData.storeLocation, orderData.destinationLocation, orderData.stops]);

  // Calculate arrival time from the Firestore-provided ETA minutes
  const getArrivalTime = useCallback(() => {
    if (etaMinutes === null) return null;
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + etaMinutes * 60000);
    return arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [etaMinutes]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 relative">
      {/* Real MapLibre Map with live driver tracking */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={driverLocation 
            ? { lat: driverLocation.lat, lng: driverLocation.lng }
            : orderData.storeLocation?.lat && orderData.storeLocation?.lng 
              ? { lat: orderData.storeLocation.lat, lng: orderData.storeLocation.lng } 
              : latitude != null && longitude != null
    ? { lat: latitude, lng: longitude }
    : { lat: -15.3875, lng: 28.3228 }}
          zoom={14}
          markers={mapMarkers}
          polyline={showRouteOverlay ? (trimmedPolyline ?? undefined) : undefined}
          driverPosition={driverLocation || undefined}
          storePosition={orderData.storeLocation || undefined}
          vehicleType={(orderData as any)?.vehicleType || driverData?.vehicle?.type || 'car'}
          vehicleColor={(driverFromOrder?.color || driverData?.vehicle?.color)}
          arrivalTime={showRouteOverlay && etaMinutes !== null ? (getArrivalTime() || undefined) : undefined}
          fitBounds={mapMarkers.length > 1}
          className="w-full h-full"
        />
      </div>

      {/* Top Status Panel */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-4 left-4 right-4 z-20"
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-4">
          <motion.h2
            key={statusTitle}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            {statusTitle}
          </motion.h2>
          <motion.p
            key={`${statusSubtitle}-${etaMinutes}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-600 dark:text-gray-300 mt-1"
          >
            {orderData.status === 'arrived' || orderData.status === 'completed' || orderData.status === 'delivered' ? (
              statusSubtitle
            ) : etaMinutes !== null ? (
              <>
                <span className="font-semibold text-[#5B2EFF]">{etaMinutes} min{etaMinutes !== 1 ? 's' : ''}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500"> away</span>
              </>
            ) : (
              statusSubtitle
            )}
          </motion.p>
        </div>
      </motion.div>

      {/* Bottom Panel */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.2 }}
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-20"
      >
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Driver Card - with skeleton loading and slide-up animation */}
          <AnimatePresence mode="wait">
            {isDriverLoading ? (
              <DriverCardSkeleton key="skeleton" />
            ) : driverData && (
              <motion.div
                key="driver-card"
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  {/* Driver Photo - from profilePicture field */}
                  <div className="relative">
                    {driverData.profileImage ? (
                      <img
                        src={driverData.profileImage}
                        alt={driverData.name}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                        {driverData.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>

                  {/* Driver Info - using firstName, rating, color, brand, model, plateNumber */}
                  <div>
                    <div className="flex items-center space-x-2">
                      {/* Driver Name (firstName) */}
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">{driverData.name || 'Driver'}</h3>
                      {/* Star Rating */}
                      <div className="flex items-center space-x-1 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                        <Star size={14} className="text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          {driverData.rating?.toFixed(1) || '0.0'}
                        </span>
                      </div>
                    </div>
                    {/* Vehicle info: color brand model */}
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {driverData.color && driverData.brand && driverData.model
                        ? `${driverData.color} ${driverData.brand} ${driverData.model}`.trim()
                        : driverData.vehicle 
                          ? `${driverData.vehicle.color || ''} ${driverData.vehicle.brand || ''} ${driverData.vehicle.model || ''}`.trim() || 'Vehicle'
                          : 'Vehicle'}
                    </p>
                    {/* Plate Number */}
                    <p className="text-gray-900 dark:text-white font-medium text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded inline-block mt-1">
                      {driverData.plateNumber || driverData.vehicle?.plateNumber || 'Unknown'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={handleCall}
                    disabled={callState !== 'idle' || (!driverData?.id && !driverData?.uid && !orderData.driverId)}
                    aria-label="Call driver"
                    className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${callState === 'in-call' ? 'bg-emerald-600' : 'bg-[#5B2EFF] hover:bg-[#4A24D9]'}`}
                  >
                    <Phone size={18} className={callState === 'calling' ? 'animate-pulse' : ''} />
                    <span>{callState === 'calling' ? 'Calling…' : callState === 'in-call' ? `In call · ${formattedTime}` : 'Call driver'}</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={handleMessage}
                    className="relative w-11 h-11 bg-gray-800 dark:bg-gray-700 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors"
                  >
                    <MessageCircle size={20} className="text-white" />
                    {unreadMessageCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-lg"
                      >
                        {unreadMessageCount}
                      </motion.span>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package size={16} className="text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {orderData.items?.length || 0} Item{(orderData.items?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-gray-900 dark:text-white">K {(orderData.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-300">Delivery fee</span>
                <span className="text-gray-900 dark:text-white">K {(orderData.fee || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2 font-bold">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">K {(orderData.total ?? ((orderData.subtotal || 0) + (orderData.fee || 0))).toFixed(2)}</span>
              </div>
            </div>
          </motion.div>

          {/* Delivery Address */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-start space-x-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
          >
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-[#5B2EFF]" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Delivery Address</p>
              <p className="text-gray-900 dark:text-white text-sm mt-1">
                {getAddressText(orderData.destinationAddress) || 'Address not specified'}
              </p>
            </div>
          </motion.div>

          {/* Stops if any */}
          {orderData.stops && orderData.stops.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-2"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Delivery Stops</p>
              {orderData.stops.map((stop, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3"
                >
                  <div className="w-6 h-6 bg-orange-200 dark:bg-orange-800 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300">{index + 1}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{getAddressText(stop) || 'Address not specified'}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isCallConfirmOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800"
              initial={{ scale: 0.94, y: 8 }}
              animate={{ scale: 1, y: 0 }}
            >
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Call driver?</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Start a private audio call with {driverData?.name || 'your driver'}.</p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setIsCallConfirmOpen(false)} className="flex-1 rounded-xl bg-red-100 px-4 py-3 font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-200">Cancel</button>
                <button type="button" onClick={() => { setIsCallConfirmOpen(false); if (orderId) void startCall(orderId); }} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">Call Driver</button>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Rating Modal - shown when status becomes "completed" */}
      <MessagePanel
        isOpen={isMessagePanelOpen}
        onClose={() => setIsMessagePanelOpen(false)}
        rideId={orderId || ''}
        currentUserId={auth.currentUser?.uid || profile?.id || ''}
        currentUserName={profile?.name || 'Client'}
        driverId={driverData?.id || orderData.driverId || ''}
        driverName={driverData?.name || 'Driver'}
        isRideActive
      />

      <RatingModal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          navigate('/', { replace: true });
        }}
        onSubmitted={() => orderId ? markOrderRated(orderId) : undefined}
        path="store_delivery"
        driverName={driverData?.name || 'Driver'}
        driverPhoto={driverData?.profileImage || driverData?.photo || ''}
        driverId={driverData?.id || orderData.driverId || ''}
        orderId={orderId || ''}
        storeName={orderData.storeName || 'Store'}
        storeImage={orderData.storeImage || ''}
        storeId={orderData.storeId || ''}
      />
    </div>
  );
};
