import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MapPin, Store, Package, Truck, User, Phone } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { soundManager } from '../utils/notificationSound';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { usePreventBack } from '../hooks/usePreventBack';
import { useCall } from '../contexts/CallContext';
import { ActiveOrder, buildTrackingState } from '../hooks/useActiveOrder';

interface OrderItem {
  name: string;
  quantity?: number;
  price: number;
  image?: string;
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
  rejectionReason?: 'still_closed' | 'out_of_stock' | string;
  driverStatus?: string;
  driverId?: string | null;
  destinationAddress?: string | AddressValue;
  stops?: Array<{ address: string | AddressValue; items?: OrderItem[] }>;
  type?: string;
  category?: string;
  refundEligible?: boolean;
  refundAmount?: number;
  cancellationReason?: string;
  cancelledAt?: unknown;
}

// Status steps for the UI timeline
// Note: "Preparing Items" is a UI-only stage that appears when status = "accepted"
const statusSteps: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'accepted', label: 'Order Accepted', icon: Check },
  { key: 'preparing', label: 'Preparing Items', icon: Package },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package },
  { key: 'searching', label: 'Assigning Driver', icon: Truck },
  { key: 'driver_assigned', label: 'Driver Assigned', icon: User },
];

// Rotating status messages for different stages
const preparingMessages = [
  "Preparing your order...",
  "Packing everything carefully...",
  "Almost ready...",
];

const searchingMessages = [
  "Looking for nearby drivers...",
  "Finding the fastest rider...",
  "Connecting to a delivery partner...",
];

// Determine which steps are completed based on Firestore status and driverStatus
// IMPORTANT: Each stage must wait for its EXACT Firestore update
// Transition to LiveTrackingPage ONLY when BOTH status === "driver_assigned" AND driverStatus === "assigned"
const getCompletedSteps = (
  status: string,
  driverStatus: string,
  preparingShown: boolean
): { completed: boolean; current: boolean }[] => {
  const steps = [
    { completed: false, current: false }, // Order Accepted
    { completed: false, current: false }, // Preparing Items
    { completed: false, current: false }, // Ready for Pickup
    { completed: false, current: false }, // Assigning Driver
    { completed: false, current: false }, // Driver Assigned
  ];

  // STRICT CHECK: status === "accepted"
  // Mark "Order Accepted" complete, "Preparing Items" becomes current (after delay)
  if (status === 'accepted') {
    steps[0] = { completed: true, current: false }; // Order Accepted
    steps[1] = { completed: preparingShown, current: !preparingShown }; // Preparing Items
    return steps;
  }

  // STRICT CHECK: status === "ready_for_pickup"
  // Mark ONLY "Ready For Pickup" - do NOT mark "Assigning Driver" or "Driver Assigned"
  // UNLESS driverStatus explicitly indicates driver search/assignment
  if (status === 'ready_for_pickup') {
    steps[0] = { completed: true, current: false }; // Order Accepted
    steps[1] = { completed: true, current: false }; // Preparing Items
    steps[2] = { completed: true, current: false }; // Ready for Pickup - STOP HERE by default

    // STRICT CHECK: Only proceed to "Assigning Driver" if driverStatus === "searching"
    if (driverStatus === 'searching') {
      steps[3] = { completed: false, current: true }; // Assigning Driver (current) - STOP HERE
    }
    // STRICT CHECK: Only proceed to "Driver Assigned" if BOTH conditions are met
    else if (driverStatus === 'assigned') {
      // Note: This case shouldn't happen often because status should be "driver_assigned" by now
      steps[3] = { completed: true, current: false }; // Assigning Driver (done)
      steps[4] = { completed: true, current: false }; // Driver Assigned
    }
    return steps;
  }

  // STRICT CHECK: driverStatus === "searching" (may arrive before status update)
  // Mark "Assigning Driver" as current - STOP HERE, do NOT mark "Driver Assigned"
  if (driverStatus === 'searching') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: false, current: true }; // Assigning Driver (current) - STOP HERE
    return steps;
  }

  // STRICT CHECK: BOTH status === "driver_assigned" AND driverStatus === "assigned"
  // Only mark all steps complete when BOTH conditions are true
  if (status === 'driver_assigned' && driverStatus === 'assigned') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: true, current: false };
    steps[4] = { completed: true, current: false }; // Driver Assigned
    return steps;
  }

  // Handle case where driverStatus === "assigned" arrives before status === "driver_assigned"
  // Mark "Driver Assigned" as current (waiting for status update)
  if (driverStatus === 'assigned' && status !== 'driver_assigned') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: true, current: false };
    steps[4] = { completed: false, current: true }; // Driver Assigned (current, waiting for status)
    return steps;
  }

  // Handle case where status === "driver_assigned" arrives before driverStatus === "assigned"
  // Mark "Driver Assigned" as current (waiting for driverStatus update)
  if (status === 'driver_assigned' && driverStatus !== 'assigned') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: true, current: false };
    steps[4] = { completed: false, current: true }; // Driver Assigned (current, waiting for driverStatus)
    return steps;
  }

  // Default: waiting for order to be accepted
  return steps;
};

export const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderData: initialOrderData } = location.state || {};
  const { clearCart } = useGlobalCart();

  const [orderData, setOrderData] = useState<OrderData>(initialOrderData || {});
  const [storeCategory, setStoreCategory] = useState('');
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const { callState, formattedTime, startCall } = useCall();
  const [preparingShown, setPreparingShown] = useState(false);
  const [rotatingMessage, setRotatingMessage] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [showCancelReasons, setShowCancelReasons] = useState(false);
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false);
  const [selectedCancellationReason, setSelectedCancellationReason] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  usePreventBack(!['completed', 'cancelled', 'delivered'].includes(orderData.status || ''));
  
  // Refs for timeouts
  const preparingDelayRef = useRef<NodeJS.Timeout | null>(null);
  const transitionDelayRef = useRef<NodeJS.Timeout | null>(null);
  const messageRotationRef = useRef<NodeJS.Timeout | null>(null);
  const rejectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | undefined>(initialOrderData?.status);

  useEffect(() => {
    let cancelled = false;
    const storeId = orderData.storeId;
    if (!storeId) {
      setStoreCategory('');
      return;
    }

    void getDoc(doc(db, 'stores', storeId)).then(snapshot => {
      if (!cancelled) setStoreCategory(String(snapshot.data()?.category || '').toLowerCase());
    }).catch(() => {
      if (!cancelled) setStoreCategory('');
    });

    return () => { cancelled = true; };
  }, [orderData.storeId]);

  // Calculate step states based on current Firestore data
  const stepStates = getCompletedSteps(
    orderData.status || '',
    orderData.driverStatus || '',
    preparingShown
  );

  // Determine current stage for rotating messages
  const currentStage = orderData.driverStatus === 'searching' 
    ? 'searching' 
    : (orderData.status === 'accepted' && !preparingShown) 
      ? 'preparing' 
      : orderData.status === 'accepted' 
        ? 'preparing' 
        : null;

  // Listen to Firestore order document in real-time
  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrderData;
        // Preserve storeImage from initial data if not in Firestore
        setOrderData({
          ...data,
          id: orderId,
          storeImage: initialOrderData?.storeImage || (data as any).storeImage || '',
          storeName: data.storeName || initialOrderData?.storeName,
          storeId: data.storeId || initialOrderData?.storeId,
        });
      }
    });

    return () => unsubscribe();
  }, [orderId, initialOrderData]);

  useEffect(() => {
    const status = orderData.status;
    if (!status || status === previousStatusRef.current) return;

    if (status === 'ready_for_pickup') {
      const itemCount = (orderData.items || []).reduce(
        (total, item) => total + (item.quantity || 1),
        0
      );
      soundManager.play(itemCount === 1 ? 'readyy' : 'ready');
    } else if (status === 'rejected') {
      const rejection = orderData.rejectionReason;
      const rejectionDetails = rejection === 'still_closed'
        ? { sound: 'closed' as const, message: 'Store is still closed, check with them later.' }
        : rejection === 'out_of_stock'
          ? { sound: 'stock' as const, message: 'This order just went out of stock.' }
          : null;

      if (rejectionDetails) {
        soundManager.play(rejectionDetails.sound);
        setRejectionMessage(rejectionDetails.message);
        rejectionTimeoutRef.current = setTimeout(() => {
          clearCart();
          navigate('/', { replace: true });
        }, 2000);
      }
    } else {
      const soundByStatus: Record<string, 'accepted' | 'store' | 'picked' | 'delivered'> = {
        accepted: 'accepted',
        at_store: 'store',
        picked_up: 'picked',
        delivered: 'delivered',
      };
      const sound = soundByStatus[status];
      if (sound) soundManager.play(sound);
    }

    previousStatusRef.current = status;
  }, [clearCart, navigate, orderData.items, orderData.rejectionReason, orderData.status]);

  useEffect(() => () => {
    if (rejectionTimeoutRef.current) clearTimeout(rejectionTimeoutRef.current);
  }, []);

  // Handle "Preparing Items" delay when status becomes "accepted"
  useEffect(() => {
    if (orderData.status === 'accepted' && !preparingShown) {
      // Clear any existing timeout
      if (preparingDelayRef.current) {
        clearTimeout(preparingDelayRef.current);
      }
      // After 5 seconds, mark "Preparing Items" as active
      preparingDelayRef.current = setTimeout(() => {
        setPreparingShown(true);
      }, 5000);
    }

    return () => {
      if (preparingDelayRef.current) {
        clearTimeout(preparingDelayRef.current);
      }
    };
  }, [orderData.status, preparingShown]);

  // Handle transition to LiveTrackingPage ONLY when BOTH conditions are met:
  // status === "driver_assigned" AND driverStatus === "assigned"
  // IMPORTANT: Do NOT transition on driverStatus === "searching"
  useEffect(() => {
    // STRICT CHECK: BOTH conditions must be true for transition
    const shouldTransition = 
      orderData.status === 'driver_assigned' && 
      orderData.driverStatus === 'assigned';

    if (shouldTransition) {
      // Clear any existing timeout
      if (transitionDelayRef.current) {
        clearTimeout(transitionDelayRef.current);
      }
      // After 1.5 seconds, transition to live tracking
      transitionDelayRef.current = setTimeout(() => {
        const trackingOrder = {
          ...orderData,
          id: orderId,
          storeId: orderData.storeId || (orderData as any).storeId,
          storeName: orderData.storeName || (orderData as any).storeName,
          storeImage: (orderData as any).storeImage || '',
          storeAddress: orderData.storeAddress || (orderData as any).storeAddress,
          storeLocation: (orderData as any).storeLocation
            || ((orderData as any).pickupLat != null && (orderData as any).pickupLng != null
              ? { lat: (orderData as any).pickupLat, lng: (orderData as any).pickupLng }
              : undefined),
        } as ActiveOrder;
        navigate('/live-tracking', {
          state: buildTrackingState(trackingOrder, orderId),
          replace: true,
        });
      }, 1500);
    }

    return () => {
      if (transitionDelayRef.current) {
        clearTimeout(transitionDelayRef.current);
      }
    };
  }, [orderData.driverStatus, orderData.status, orderId, navigate, orderData]);

  // Rotate status messages every 3-4 seconds
  useEffect(() => {
    const messages = currentStage === 'searching' ? searchingMessages : preparingMessages;
    
    if (currentStage) {
      setRotatingMessage(messages[0]);
      
      messageRotationRef.current = setInterval(() => {
        setMessageIndex((prev) => {
          const nextIndex = (prev + 1) % messages.length;
          setRotatingMessage(messages[nextIndex]);
          return nextIndex;
        });
      }, 3500);
    }

    return () => {
      if (messageRotationRef.current) {
        clearInterval(messageRotationRef.current);
      }
    };
  }, [currentStage]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  const canCancelOrder = !orderData.driverId && !['assigned', 'at_store', 'picked_up'].includes(orderData.driverStatus || '') && ['pending', 'accepted', 'preparing', 'ready_for_pickup'].includes(orderData.status || '');
  const cancellationFeeApplies = ['accepted', 'preparing', 'ready_for_pickup'].includes(orderData.status || '');
  const category = String(orderData.category || orderData.type || 'food').toLowerCase();
  const normalizedCategory = category === 'clothes' || category === 'hardware' || category === 'small_shop' || category === 'market' ? category : 'food';
  const isCallableStoreOrder = ['market', 'small_shop'].includes(storeCategory)
    || ['market', 'small_shop'].includes(String(orderData.category || orderData.type || '').toLowerCase());
  const canCallStore = isCallableStoreOrder
    && ['pending', 'accepted', 'ready_for_pickup'].includes(orderData.status || '')
    && ['waiting', 'no_driver_found', ''].includes(orderData.driverStatus || '');

  const handleCancelRequest = () => {
    if (!canCancelOrder || isCancelling) return;
    setSelectedCancellationReason(null);
    setShowCancelReasons(true);
  };

  const handleCancelOrder = async () => {
    if (!orderId || !selectedCancellationReason || isCancelling) return;
    if (cancellationFeeApplies && !showFeeConfirmation) {
      setShowCancelReasons(false);
      setShowFeeConfirmation(true);
      return;
    }

    setIsCancelling(true);
    try {
      const subtotal = orderData.subtotal || 0;
      const fee = orderData.fee || 0;
      await updateDoc(doc(db, 'orders', orderId), {
        status: cancellationFeeApplies ? 'cancelled_pending_refund' : 'cancelled',
        cancellationReason: selectedCancellationReason,
        refundEligible: true,
        refundAmount: cancellationFeeApplies ? subtotal : subtotal + fee,
        cancelledAt: serverTimestamp(),
      });
      setShowCancelReasons(false);
      setShowFeeConfirmation(false);
      clearCart();
      navigate('/shop', { state: { category: normalizedCategory }, replace: true });
    } catch (error) {
      console.error('Failed to cancel order:', error);
      setIsCancelling(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      <AnimatePresence>
        {rejectionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            role="alert"
            className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-3 text-center text-sm text-white shadow-lg"
          >
            {rejectionMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED TOP PANEL - Store info */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex-shrink-0 bg-white dark:bg-gray-900 shadow-md px-4 py-4 z-20"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{orderData.storeName || 'Store'}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">#{orderId?.slice(-4).toUpperCase() || 'Order'}</p>
          </div>
          <div className="flex items-center gap-3">
            {canCallStore && (
              <button
                type="button"
                disabled={callState !== 'idle'}
                onClick={() => { if (orderId && callState === 'idle') void startCall(orderId, 'Store'); }}
                aria-label={callState === 'calling' ? 'Calling store' : callState === 'in-call' ? `In call · ${formattedTime}` : 'Call store'}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-80 ${callState === 'in-call' ? 'bg-emerald-600 text-white' : 'bg-[#5B2EFF] text-white hover:bg-[#4A24D9]'}`}
              >
                <Phone size={17} className={callState === 'calling' ? 'animate-pulse' : ''} />
                <span>{callState === 'calling' ? 'Calling…' : callState === 'in-call' ? `In call · ${formattedTime}` : 'Call store'}</span>
              </button>
            )}
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                K {orderData.total?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* STATIC STATUS TIMELINE - Center of screen, no scroll */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-4 w-full max-w-md"
        >
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-0">
            {statusSteps.map((step, index) => {
              const { completed: isCompleted, current: isCurrent } = stepStates[index];
              const Icon = step.icon;

              return (
                <motion.div key={step.key} variants={itemVariants} className="relative">
                  <div className="flex items-start">
                    {/* Timeline Line with animated fill */}
                    {index < statusSteps.length - 1 && (
                      <div className="absolute left-[15px] top-[28px] w-0.5 h-8 bg-gray-200">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="bg-[#5B2EFF] w-full"
                        />
                      </div>
                    )}

                    {/* Icon Circle with animations */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={
                        isCurrent 
                          ? { 
                              scale: [1, 1.15, 1], 
                              opacity: 1,
                              boxShadow: ['0 0 0 0 rgba(91, 46, 255, 0.4)', '0 0 0 8px rgba(91, 46, 255, 0)', '0 0 0 0 rgba(91, 46, 255, 0.4)']
                            } 
                          : { scale: 1, opacity: 1 }
                      }
                      transition={isCurrent ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : { duration: 0.3 }}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted
                          ? 'bg-[#5B2EFF] text-white'
                          : isCurrent
                          ? 'bg-[#5B2EFF] text-white ring-4 ring-[#F3EEFF]'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        >
                          <Check size={16} />
                        </motion.div>
                      ) : (
                        <Icon size={16} />
                      )}
                    </motion.div>

                    {/* Label with bold animation */}
                    <div className="ml-3 pb-6">
                      <motion.p
                        animate={{ 
                          fontWeight: isCurrent ? 700 : isCompleted ? 500 : 400,
                          color: isCompleted || isCurrent ? '#111827' : '#9ca3af'
                        }}
                        transition={{ duration: 0.3 }}
                        className="text-sm"
                      >
                        {step.label}
                      </motion.p>
                      
                      {/* Pulsing indicator and rotating message for current step */}
                      {isCurrent && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center mt-1 space-x-2"
                        >
                          {/* Pulsing dot */}
                          <motion.div
                            animate={{ 
                              scale: [1, 1.3, 1],
                              opacity: [0.7, 1, 0.7]
                            }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                            className="w-2 h-2 bg-[#5B2EFF] rounded-full"
                          />
                          
                          {/* Loading dots for searching */}
                          {step.key === 'searching' && (
                            <div className="flex space-x-1">
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  animate={{ 
                                    y: [0, -4, 0],
                                    opacity: [0.5, 1, 0.5]
                                  }}
                                  transition={{ 
                                    repeat: Infinity, 
                                    duration: 0.8, 
                                    delay: i * 0.15,
                                    ease: 'easeInOut'
                                  }}
                                  className="w-1.5 h-1.5 bg-[#5B2EFF] rounded-full"
                                />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Rotating status message */}
          <AnimatePresence mode="wait">
            {rotatingMessage && (
              <motion.div
                key={rotatingMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mt-4 text-center"
              >
                <p className="text-sm text-gray-600 italic">{rotatingMessage}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* FIXED BOTTOM PANELS */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
        {/* Order Summary Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-4 pt-4 pb-2 border-b border-gray-100 dark:border-gray-800"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Order Summary</h2>
          </div>
          
          {/* Scrollable items list - only this scrolls */}
          <div className="max-h-32 overflow-y-auto">
            {orderData.items && orderData.items.length > 0 ? (
              <div className="space-y-2">
                {orderData.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center space-x-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package size={16} className="text-gray-400" />
                        </div>
                      )}
                      <p className="text-sm text-gray-900 dark:text-white">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">x{item.quantity || 1}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">K {(item.price * (item.quantity || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">No items in order</p>
            )}
          </div>

          {/* Totals - always visible */}
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">K {orderData.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="text-gray-900">K {orderData.fee?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-100">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">K {orderData.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </motion.div>

        {/* Delivery Address Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="px-4 py-3"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-[#F3EEFF] rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-[#5B2EFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white text-sm">Delivery to</p>
              <p className="text-gray-600 dark:text-gray-400 text-xs truncate">{getAddressText(orderData.destinationAddress) || 'Address not specified'}</p>
            </div>
          </div>

          {/* Multiple Stops */}
          {orderData.stops && orderData.stops.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="font-medium text-gray-900 text-xs mb-2">Delivery Stops</p>
              {orderData.stops.map((stop, index) => (
                <div key={index} className="flex items-start space-x-2 mb-1 last:mb-0">
                  <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-orange-600">{index + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{getAddressText(stop) || 'Address not specified'}</p>
                </div>
              ))}
            </div>
          )}

          {canCancelOrder && (
            <button
              type="button"
              onClick={handleCancelRequest}
              disabled={isCancelling}
              className="mt-4 w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 active:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Cancel order
            </button>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {(showCancelReasons || showFeeConfirmation) && (
          <>
            <motion.button
              type="button"
              aria-label="Close cancellation dialog"
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCancelReasons(false); setShowFeeConfirmation(false); }}
            />
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-order-title"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl dark:bg-gray-900"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            >
              {showFeeConfirmation ? (
                <>
                  <h2 id="cancel-order-title" className="text-lg font-bold text-gray-900 dark:text-white">Cancel order?</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    The store has started preparing your order. Your delivery fee of K {(orderData.fee || 0).toFixed(2)} will not be refunded.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <button type="button" onClick={() => setShowFeeConfirmation(false)} className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Keep order</button>
                    <button type="button" disabled={isCancelling} onClick={handleCancelOrder} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">Cancel order</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 id="cancel-order-title" className="text-lg font-bold text-gray-900 dark:text-white">Why are you cancelling?</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose a reason so we can improve your experience.</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {['Order is taking too long', 'Ordered by mistake', 'Changed my mind', 'Found it cheaper elsewhere', 'Entered the wrong address', 'Other'].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        aria-pressed={selectedCancellationReason === reason}
                        onClick={() => setSelectedCancellationReason(reason)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${selectedCancellationReason === reason ? 'border-[#5B2EFF] bg-[#F3EEFF] text-[#5B2EFF]' : 'border-gray-200 text-gray-800 hover:border-[#5B2EFF] hover:bg-[#F3EEFF] dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800'}`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!selectedCancellationReason || isCancelling}
                    onClick={handleCancelOrder}
                    className="mt-5 w-full rounded-xl bg-[#5B2EFF] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Done
                  </button>
                </>
              )}
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
