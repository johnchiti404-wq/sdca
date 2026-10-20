import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { useFirebaseRide } from '../hooks/useFirebaseRide';
import { useUserProfile } from '../hooks/useUserProfile';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { subscribeToOrder, cancelOrder } from '../services/orderService';
import { usePreventBack } from '../hooks/usePreventBack';
import { ActiveOrder, buildTrackingState } from '../hooks/useActiveOrder';

interface WaitingForDriverProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  currentRideId: string | null;
  onCancel: () => void;
  onDriverFound: () => void;
}

export const WaitingForDriver: React.FC<WaitingForDriverProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  currentRideId,
  onCancel,
  onDriverFound
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [showNoDriverPopup, setShowNoDriverPopup] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const { createRide, currentRide, isLoading } = useFirebaseRide(currentRideId);
  const { profile } = useUserProfile();
  usePreventBack(true);

  const { 
    orderType = 'ride', 
    requestId, 
    orderId: stateOrderId,
    orderData = {},
    useFirestore = false // Flag to determine which DB to use
  } = location.state || {};
  
  const isFood = orderType === 'food' || orderType === 'small_shop' || orderType === 'market';
  // Services that use the ride-like flow (no store)
  const isRideLikeService = orderType === 'package' || orderType === 'towing' || orderType === 'truck';
  const isService = orderType === 'service' || isRideLikeService;
  const isRide = orderType === 'ride';
  const orderId = stateOrderId || requestId || currentRideId;

  const finalDestination = isService ? (orderData.destinationAddress || orderData.destination) : (isFood ? orderData.destinationAddress : (orderData.destination || destination));
  const finalPickup = isService ? (orderData.pickupAddress || orderData.pickup) : (isFood ? orderData.pickupAddress : (orderData.pickup || pickup));
  const finalStops = isService ? (orderData.stops || []) : (isFood ? (orderData.stops || []) : (orderData.stops || stops));
  const finalCarType = isService 
    ? (orderData.vehicleClass || orderData.vehicleTitle || orderData.vehicleCategory) 
    : (isFood ? orderData.deliveryMode?.label : (orderData.vehicleTitle || orderData.rideName || carType));
  const finalPrice = isService 
    ? (orderData.pricing?.basePrice || orderData.price || orderData.total) 
    : (isFood ? orderData.totalPrice : (orderData.price || orderData.estimatedPrice || price));

  // Encoded route polyline passed through from ConfirmOrder.
  const encodedPolyline = orderData.encodedPolyline;

  // Derive ETA minutes from orderData.eta (may be a number or a "X min" string).
  const pickupEtaMinutes = (() => {
    const raw = orderData.eta;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  })();

  // Calculate arrival time the same way ConfirmOrder does: add the ETA minutes to
  // the current time and format as "H:MM AM/PM".
  const getArrivalTime = (): string | undefined => {
    if (pickupEtaMinutes === undefined) return undefined;
    const now = new Date();
    const arrival = new Date(now.getTime() + pickupEtaMinutes * 60000);
    return arrival.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Build map markers. Pickup/dropoff are shown by the polyline's ETA bubble
  // (start) and Arrive-by card (end), so only intermediate stops get a marker.
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    (orderData.stopCoords || []).forEach((stop: { lat?: number; lng?: number }, index: number) => {
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
    return markers;
  }, [orderData.stopCoords]);

  // Keep the scanning progress animated while the backend is searching.
  useEffect(() => {
    if (!isScanning) return;

    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 100 / 30));
    }, 1000);

    return () => clearInterval(timer);
  }, [isScanning]);

  // Listen to order status changes from unified orders collection
  useEffect(() => {
    if (!orderId) return;

    // Subscribe to unified orders collection
    const unsubscribe = subscribeToOrder(orderId, (order) => {
      if (!order) return;

      if (order.driverStatus === 'no_driver_found') {
        setIsScanning(false);
        setShowNoDriverPopup(true);
        return;
      }

      setIsScanning(order.driverStatus === 'searching' || order.driverStatus === 'waiting');

      // When driver accepts, navigate to driver-coming page
      if (order.status === 'accepted' || order.status === 'arriving') {
        setIsScanning(false);
        setTimeout(() => {
          const trackingOrder = {
            ...orderData,
            ...order,
            encodedPolyline: order.encodedPolyline || encodedPolyline,
          } as ActiveOrder;
          navigate('/driver-coming', {
            state: buildTrackingState(trackingOrder, orderId),
            replace: true,
          });
        }, 500);
      }
    });

    return () => unsubscribe();
  }, [orderId, navigate, orderData]);

  const handleRequestAgain = async () => {
    if (isLoading || !orderId) return;

    try {
      const isStoreDelivery = Boolean(orderData.workflowType === 'store_delivery' || isFood);
      await updateDoc(doc(db, 'orders', orderId), {
        driverStatus: 'waiting',
        status: isStoreDelivery ? 'ready_for_pickup' : 'pending',
      });
      setShowNoDriverPopup(false);
      setProgress(0);
      setIsScanning(true);
    } catch (error) {
      console.error('Error requesting another driver:', error);
    }
  };

  const handleCancel = () => {
    setShowCancelConfirmation(true);
  };

  const handleConfirmCancel = async () => {
    try {
      // Cancel order via unified service
      if (orderId) {
        await cancelOrder(orderId, 'User cancelled while waiting');
      }

      // Clear localStorage
      setShowCancelConfirmation(false);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error cancelling order:', error);
      setShowCancelConfirmation(false);
    }
  };

  const handleWaitForDriver = () => {
    setShowCancelConfirmation(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Real MapLibre Map Background */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={orderData.pickupCoords?.lat && orderData.pickupCoords?.lng 
            ? { lat: orderData.pickupCoords.lat, lng: orderData.pickupCoords.lng } 
            : { lat: -15.3875, lng: 28.3228 }}
          zoom={13}
          markers={mapMarkers}
          polyline={encodedPolyline ?? undefined}
          pickupEta={pickupEtaMinutes}
          arrivalTime={getArrivalTime()}
          fitBounds={mapMarkers.length > 1}
          className="w-full h-full"
        />
      </div>

      <motion.div
        className="absolute top-0 left-0 right-0 z-10 p-4"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex justify-between items-center">
          <button
            onClick={handleCancel}
            className="text-red-600 font-medium text-sm hover:text-red-700"
          >
            Cancel
          </button>
          <h2 className="text-gray-800 font-bold">
            Finding {orderType === 'package' ? 'courier' : 
                     orderType === 'towing' ? 'tow truck' : 
                     orderType === 'truck' ? 'truck' : 
                     isService ? 'service provider' : 
                     isFood ? 'delivery driver' : 'driver'}
          </h2>
          <div className="w-8" />
        </div>
      </motion.div>

      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-6 z-20"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Searching...</span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#5B2EFF]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{finalDestination}</h2>
            {finalStops.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">via {finalStops.length} stop{finalStops.length > 1 ? 's' : ''}</p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {finalStops.map((stop: string, index: number) => (
                    <span key={index}>
                      {stop}{index < finalStops.length - 1 ? ' → ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-center space-x-4 mt-4">
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">{finalCarType}</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">K {finalPrice}</span>
            </div>
          </div>

          <AnimatePresence>
            {showNoDriverPopup && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">⏱️</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">No drivers available</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                    We couldn&apos;t find a driver in your area. Try again in a few moments.
                  </p>

                  <motion.button
                    onClick={handleRequestAgain}
                    className="w-full bg-[#5B2EFF] text-white py-4 rounded-2xl font-semibold text-lg hover:bg-[#4A24D9] mb-3"
                    whileTap={{ scale: 0.98 }}
                  >
                    Try again
                  </motion.button>
                  <motion.button
                    onClick={onCancel}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCancelConfirmation && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-sm w-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">👋</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Cancel {isFood ? 'food order' : 'ride'}?</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                    {isFood
                      ? 'Are you sure you want to cancel this food order?'
                      : 'Are you sure you want to cancel this ride request?'}
                  </p>

                  <motion.button
                    onClick={handleConfirmCancel}
                    className="w-full bg-red-500 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-red-600 mb-3"
                    whileTap={{ scale: 0.98 }}
                  >
                    Yes, cancel
                  </motion.button>
                  <motion.button
                    onClick={handleWaitForDriver}
                    className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                    whileTap={{ scale: 0.98 }}
                  >
                    Keep waiting
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
