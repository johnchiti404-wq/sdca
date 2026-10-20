import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users } from 'lucide-react';
import { MapLibreMap, MapMarker } from '../components/MapLibreMap';
import { useUserProfile } from '../hooks/useUserProfile';
import { useActiveOrder } from '../hooks/useActiveOrder';
import { useGeolocation } from '../hooks/useGeolocation';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../config/firebase';
import {
  createOrder,
  ServiceType,
  CategoryType,
  WorkflowType,
  CreateOrderInput
} from '../services/orderService';

interface RideData {
  pricingId: string;
  name: string;
  estimatedPrice: number;
  originalPrice: number;
  eta: string;
  vehicleCategory: string;
  seats: number;
  dispatchService?: string;
  selectedVehicle?: string;
}

const getAddressText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'address' in value) {
    const address = (value as { address?: unknown }).address;
    return typeof address === 'string' ? address : '';
  }
  return '';
};

interface ConfirmOrderProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  onBack: () => void;
  onRideConfirmed: () => void;
  onRideCreated: (rideId: string) => void;
}

export const ConfirmOrder: React.FC<ConfirmOrderProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  onBack,
  onRideConfirmed,
  onRideCreated,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useUserProfile();
  const { order: activeOrder } = useActiveOrder();
  const isRideActive = Boolean(activeOrder);
  const { latitude, longitude } = useGeolocation();

  const {
    orderType = 'ride',
    type = '',
    orderData = {},
    serviceType: navServiceType, // Explicit serviceType from navigation
    vehicle,
    extraSelection,
    pickupAddress,
    destinationAddress,
    rideData,
    pickupCoords,
    destinationCoords,
    stopCoords = [],
    encodedPolyline
  } = location.state || {};

  // Use explicit serviceType from navigation if provided, otherwise infer
  const serviceType = navServiceType || orderData.serviceType;

  // Determine order type - MUST use correct logic for all flows
  // delivery = food, clothes, hardware (store-based delivery)
  // ride = ride service (passenger transport)  
  // service = package, towing, truck (special services)
  const isDelivery = orderType === 'delivery';
  const isFood = orderType === 'food' || type === 'food';
  const isClothes = type === 'clothes';
  const isHardware = type === 'hardware';
  const isSmallShop = type === 'small_shop';
  const isMarket = type === 'market';
  
  // isService covers special services (package, towing, truck) that don't have stores
  // MUST be checked BEFORE isRide since serviceType takes priority
  const isService = serviceType === 'package' || serviceType === 'towing' || serviceType === 'truck';
  
  // isRide is true ONLY if this is a ride flow AND NOT a service flow
  // CRITICAL: Package/Truck flows should NOT be treated as rides even if rideData is present
  const isRide = orderType === 'ride' && rideData && !isService;
  
  // isStoreDelivery covers all store-based delivery flows (food, clothes, hardware)
  const isStoreDelivery = isDelivery || isFood || isClothes || isHardware || isSmallShop;

  // Get final addresses based on flow type
  const finalDestination = isRide 
    ? destinationAddress 
    : isStoreDelivery 
      ? orderData.destinationAddress 
      : isService 
        ? destinationAddress 
        : destination;
        
  const finalPickup = isRide 
    ? pickupAddress 
    : isStoreDelivery 
      ? (orderData.storeAddress || orderData.storeName || orderData.pickupAddress) 
      : isService 
        ? pickupAddress 
        : pickup;
        
  const finalDestinationText = getAddressText(finalDestination);
  const finalPickupText = getAddressText(finalPickup);
  const finalStops = isStoreDelivery
    ? (orderData.stops || []).map((stop: any) => ({
        ...stop,
        address: getAddressText(stop?.address ?? stop),
      }))
    : stops.map((stop) => getAddressText(stop));

  const getServiceLabel = () => {
    if (serviceType === 'package') return 'Package Delivery';
    if (serviceType === 'towing') return 'Towing Service';
    if (serviceType === 'truck') return 'Truck Service';
    return '';
  };

  const getExtraSelectionLabel = () => {
    if (serviceType === 'package') return 'Weight';
    if (serviceType === 'towing') return 'Vehicle Type';
    if (serviceType === 'truck') return 'Cargo Type';
    return '';
  };

  /**
   * Unified order creation for all service types
   * Uses the EXACT document structure from specification:
   * 
   * SERVICE MAPPING:
   * - Ride: serviceType = "ride"
   * - Food: serviceType = "courier", category = "food"
   * - Clothes: serviceType = "courier", category = "clothes"
   * - Package: serviceType = "courier", category = "package"
   * - Hardware: serviceType = "delivery", category = "hardware"
   * - Small Shops: serviceType = "courier", category = "small_shop"
   * - Truck: serviceType = "delivery_truck"
   * - Towing: serviceType = "towing"
   * 
   * CRITICAL: Frontend MUST use the EXACT serviceType that matches the flow.
   * DO NOT hardcode "ride" for delivery orders!
   */
  const createUnifiedOrder = async (): Promise<string> => {
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || profile?.id || 'guest';
    const userName = currentUser?.displayName || profile?.name || '';
    const userEmail = currentUser?.email || profile?.email || '';

    // Determine serviceType and category based on the exact specification
    let svcType: ServiceType = 'ride';
    let category: CategoryType | undefined = undefined;
    let subType: string | undefined = undefined;
    let selectedVehicleTitle: string | undefined = undefined;
    let dispatchServiceValue: string | undefined = undefined;
    
    // REQUIRED: Determine workflowType for backend dispatch logic
    // "store_delivery" = food, clothes, hardware, small_shop (wait for store ready_for_pickup)
    // "direct_trip" = ride, package, delivery_truck, towing (dispatch immediately)
    let workflowType: WorkflowType = 'direct_trip'; // Default to direct_trip

    // CRITICAL: Map to exact spec based on flow type
    // Priority order: explicit serviceType from navigation > orderData > inferred from type
    
    if (serviceType === 'package') {
      // Send My Package flow -> serviceType: "courier", category: "package"
      svcType = 'courier';
      category = 'package';
      workflowType = 'direct_trip'; // Package is direct trip
      // IMPORTANT: Use backend dispatchService, DO NOT hardcode
      subType = vehicle?.dispatchService || vehicle?.id || 'delivery_motorbike';
      // SAVE dispatch service from backend
      dispatchServiceValue = vehicle?.dispatchService;
      selectedVehicleTitle = vehicle?.title || vehicle?.name;
    } else if (serviceType === 'towing') {
      // Towing flow -> serviceType: "towing"
      svcType = 'towing';
      workflowType = 'direct_trip'; // Towing is direct trip
      subType = vehicle?.id || extraSelection || 'flatbed';
    } else if (serviceType === 'truck') {
      // Truck delivery flow -> serviceType: "delivery_truck"
      svcType = 'delivery_truck';
      workflowType = 'direct_trip'; // Delivery truck is direct trip
      // Use backend-provided dispatchService and vehicle title
      subType = vehicle?.dispatchService || vehicle?.id || extraSelection || 'closed';
      selectedVehicleTitle = vehicle?.title || vehicle?.name;
      dispatchServiceValue = vehicle?.dispatchService;
    } else if (type === 'food' || isFood) {
      // Foodies flow -> serviceType: "courier", category: "food"
      svcType = 'courier';
      category = 'food';
      workflowType = 'store_delivery'; // Food is store delivery
      subType = orderData.dispatchService || orderData.deliveryMode?.id || 'motorbike';
      dispatchServiceValue = orderData.dispatchService;
    } else if (type === 'clothes' || isClothes) {
      // Clothes flow -> serviceType: "courier", category: "clothes"
      svcType = 'courier';
      category = 'clothes';
      workflowType = 'store_delivery'; // Clothes is store delivery
      subType = orderData.dispatchService || orderData.deliveryMode?.id || 'motorbike';
      dispatchServiceValue = orderData.dispatchService;
    } else if (type === 'hardware' || isHardware) {
      // Hardware flow -> serviceType: "delivery", category: "hardware"
      svcType = 'delivery';
      category = 'hardware';
      workflowType = 'store_delivery'; // Hardware is store delivery
      subType = orderData.dispatchService || orderData.deliveryMode?.id || 'car';
      dispatchServiceValue = orderData.dispatchService;
    } else if (isSmallShop || isMarket) {
      svcType = 'courier';
      category = isMarket ? 'market' : 'small_shop';
      workflowType = 'store_delivery';
      subType = orderData.dispatchService || orderData.deliveryMode?.id || 'motorbike';
      dispatchServiceValue = orderData.dispatchService;
    } else if (isRide) {
      // Ride flow -> serviceType: "ride"
      svcType = 'ride';
      workflowType = 'direct_trip'; // Ride is direct trip
      // For rides, subType is the vehicle class (economy, premium, xl, etc.)
      subType = rideData?.pricingId || rideData?.vehicleCategory || 'economy';
      dispatchServiceValue = rideData?.dispatchService;
    }



    // Determine the correct selectedVehicle and dispatchService values
    // For trucks: use backend-provided title (e.g., "1.5 ton refrigerated truck")
    // For other services: use the selected vehicle ID or category
    const finalSelectedVehicle = selectedVehicleTitle 
      || (isRide ? rideData?.selectedVehicle || rideData?.pricingId : undefined)
      || orderData.selectedVehicle 
      || orderData.deliveryMode?.id 
      || vehicle?.id 
      || '';

    const finalDispatchService = dispatchServiceValue 
      || (isRide ? rideData?.dispatchService : undefined)
      || orderData.dispatchService 
      || '';

    // Build order input with EXACT document structure
    const orderInput: CreateOrderInput & Record<string, unknown> = {
      // User info
      userId,
      userName,
      userEmail,
      
      // Service identification (REQUIRED) - USING CORRECT VALUES
      serviceType: svcType,
      
      // REQUIRED: Workflow type for backend dispatch logic
      workflowType,
      
      category,
      subType,
      selectedVehicle: finalSelectedVehicle,
      dispatchService: finalDispatchService,

      // Locations (exact spec format)
      pickupAddress: finalPickup || pickupAddress || '',
      destinationAddress: finalDestination || destinationAddress || '',
      pickupLat: pickupCoords?.lat || latitude || null,
      pickupLng: pickupCoords?.lng || longitude || null,
      dropLat: destinationCoords?.lat || null,
  dropLng: destinationCoords?.lng || null,
  customerLat: orderData.customerLat ?? null,
  customerLng: orderData.customerLng ?? null,

  // Pricing
      fee: isRide ? rideData?.estimatedPrice : (vehicle?.price || orderData.deliveryFee || 0),
      subtotal: orderData.subtotal || orderData.foodSubtotal || 0,
      total: isRide ? rideData?.estimatedPrice : (orderData.totalPrice || vehicle?.price || 0),
      
      // Trip info
      estimatedTime: isRide 
        ? parseInt(rideData?.eta?.replace(' min', '') || '10') 
        : (parseInt(orderData.deliveryMode?.time) || vehicle?.eta || 20),
      
      // Store info (for store-based orders)
  storeName: orderData.storeName || '',
  storeImage: orderData.storeImage || '',
  totalKg: typeof orderData.totalKg === 'number' ? orderData.totalKg : 0,
  kg: orderData.kg || '',
  storeCategory: orderData.storeCategory || category,
  storeId: orderData.storeId || null,
  storeDistanceKm: orderData.storeDistanceKm ?? null,
  encodedPolyline: encodedPolyline || orderData.encodedPolyline || undefined,
      
      // Stops - use real coordinates. For ride flows the stops are address
      // strings paired with stopCoords; for store deliveries each stop is an
      // object that already carries its own lat/lng.
      stops: (finalStops || []).map((stop: any, index: number) => ({
        address: typeof stop === 'string' ? stop : (stop?.address || ''),
        lat: (typeof stop === 'object' && stop?.lat) ? stop.lat : (stopCoords[index]?.lat ?? 0),
        lng: (typeof stop === 'object' && stop?.lng) ? stop.lng : (stopCoords[index]?.lng ?? 0),
      })),
      
      // Legacy fields for backward compatibility
      vehicleCategory: isRide ? rideData?.vehicleCategory : (orderData.vehicleCategory || vehicle?.id || vehicle?.name || orderData.deliveryMode?.id || ''),
      vehicleTitle: isRide ? rideData?.name : (vehicle?.name || orderData.deliveryMode?.label || ''),
      paymentMethod: 'cash',
      currency: 'ZMW',
      ratingStatus: 'pending',
      ratingPromptCount: 0,
    };

    // Add items for store-based orders (food, clothes, hardware)
    if (isStoreDelivery || category === 'food' || category === 'clothes' || category === 'hardware' || category === 'small_shop') {
      const cleanItems = (orderData.items || []).map((item: any) => ({
        id: item.id || '',
        name: item.name || '',
        price: item.price || 0,
        quantity: item.quantity || 1,
        image: item.image || '',
        storeName: orderData.storeName || '',
        storeId: orderData.storeId || '',
        unit: item.unit ?? null,
        kg: item.kg ?? 0,
      }));
      orderInput.items = cleanItems;
      orderInput.kg = orderData.kg || '';
    }

    // Add service-specific data
    if (serviceType === 'package' || category === 'package') {
      orderInput.packageDetails = {
        description: extraSelection || '',
        weight: extraSelection || '',
        recipientName: '',
        recipientPhone: '',
      };
    }

    if (serviceType === 'towing' || svcType === 'towing') {
      orderInput.towingDetails = {
        vehicleMake: extraSelection || '',
        vehicleModel: '',
        issue: '',
      };
      orderInput.vehicleType = extraSelection || '';
    }

    if (serviceType === 'truck' || svcType === 'delivery_truck') {
      orderInput.truckDetails = {
        loadDescription: extraSelection || '',
      };
      orderInput.truckType = extraSelection || vehicle?.id || '';
    }

    // Create the order in the unified orders collection
    const orderId = await createOrder(orderInput);
    return orderId;
  };

  const handleConfirmOrder = async () => {
    if (isLoading || isRideActive) {
      if (isRideActive) {
        alert('You already have an active order.');
      }
      return;
    }

    setIsLoading(true);

    try {
      // Use unified order creation for all service types
      const orderId = await createUnifiedOrder();

      // Notify parent component
      if (onRideCreated) {
        onRideCreated(orderId);
      }

      // Determine navigation destination based on SERVICE FLOW:
      // RIDE-LIKE FLOW (no store): ride, package, towing, truck -> /waiting-for-driver
      // STORE FLOW: food, clothes, hardware -> /order-tracking
      const isStoreFlow = isStoreDelivery;
      const isRideLikeFlow = isRide || isService;
      
      const navigateTo = isStoreFlow ? '/order-tracking' : '/waiting-for-driver';

      navigate(navigateTo, {
        replace: true,
        state: {
          orderId,
          orderType: isService ? serviceType : (isStoreFlow ? (type || 'food') : 'ride'),
          orderData: {
            pickup: finalPickup || pickupAddress,
            destination: finalDestination || destinationAddress,
            pickupAddress: finalPickup || pickupAddress,
            destinationAddress: finalDestination || destinationAddress,
            stops: finalStops,
            stopCoords,
            pickupCoords,
            destinationCoords,
            encodedPolyline,
            vehicleCategory: isRide ? rideData?.vehicleCategory : (vehicle?.id || vehicle?.name || orderData.deliveryMode?.id),
            vehicleTitle: isRide ? rideData?.name : (vehicle?.name || orderData.deliveryMode?.label),
            price: isRide ? rideData?.estimatedPrice : (vehicle?.price || orderData.totalPrice),
            eta: isRide ? rideData?.eta : (vehicle?.eta || orderData.deliveryMode?.time),
            status: 'pending',
            // Include store info for store flow
            ...(isStoreFlow && {
              storeName: orderData.storeName,
              storeId: orderData.storeId,
              storeImage: orderData.storeImage || '',
              storeAddress: orderData.storeAddress || '',
              storeLocation: orderData.storeLocation || undefined,
              items: orderData.items,
              subtotal: orderData.subtotal || orderData.foodSubtotal,
              deliveryFee: orderData.deliveryFee,
              totalPrice: orderData.totalPrice
            })
          }
        }
      });
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Build map markers. Pickup/dropoff are shown by the polyline's ETA bubble
  // (start) and Arrive-by card (end), so only intermediate stops get a marker.
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    (stopCoords || []).forEach((stop: { lat?: number; lng?: number }, index: number) => {
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
  }, [stopCoords]);

  // Calculate arrival time
  const getArrivalTime = useCallback(() => {
    const eta = isRide ? parseInt(rideData?.eta?.replace(' min', '') || '2') : 2;
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + eta * 60000);
    return arrivalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [isRide, rideData]);

  return (
    <div className="min-h-screen relative overflow-hidden dark:bg-gray-900">
      {/* Real MapLibre Map Background */}
      <div className="absolute inset-0 z-0">
        <MapLibreMap
          center={pickupCoords?.lat && pickupCoords?.lng 
            ? { lat: pickupCoords.lat, lng: pickupCoords.lng } 
            : latitude != null && longitude != null
    ? { lat: latitude, lng: longitude }
    : { lat: -15.3875, lng: 28.3228 }}
          zoom={14}
          markers={mapMarkers}
          polyline={encodedPolyline ?? undefined}
          pickupEta={isRide ? parseInt(rideData?.eta?.replace(' min', '') || '2') : (vehicle?.eta ?? 2)}
          arrivalTime={getArrivalTime()}
          fitBounds={mapMarkers.length > 1}
          className="w-full h-full"
        />
      </div>

      <AnimatePresence>
        {!isLoading && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-10 p-4"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-800 dark:text-gray-200" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl z-20 max-h-[80vh] flex flex-col"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        {/* STATIC HEADEK - Vehicle title and ETA */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          {isService ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{vehicle?.name || getServiceLabel()}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{vehicle?.eta ? `${vehicle.eta} min away` : 'Ready for pickup'}</p>
            </div>
          ) : isStoreDelivery ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{orderData.deliveryMode?.label || 'Delivery'}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{orderData.deliveryMode?.time ? `${orderData.deliveryMode.time} away` : 'Ready for delivery'}</p>
            </div>
          ) : isRide && rideData ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{rideData.name}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{rideData.eta} away</p>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{carType || 'Order'}</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Ready</p>
            </div>
          )}
        </div>

        {/* SCROLLABLE CONTENT - Order details, addresses, payment */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isService ? (
            <>
              {/* Trip Details for Service (package, towing, truck) */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Trip Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Pickup</span>
                      <p className="text-gray-900 dark:text-white font-medium">{getAddressText(pickupAddress) || finalPickupText || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Destination</span>
                      <p className="text-gray-900 dark:text-white font-medium">{getAddressText(destinationAddress) || finalDestinationText || 'Not specified'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery/Towing Details - NO passengers */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  {serviceType === 'towing' ? 'Towing Details' : 'Delivery Details'}
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Delivery Type</span>
                    <span className="text-gray-900 dark:text-white font-medium">{vehicle?.name || getServiceLabel()}</span>
                  </div>
                  {extraSelection && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">{getExtraSelectionLabel()}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{extraSelection}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment Summary</h3>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">K {vehicle?.price || 0}</span>
                </div>
              </div>
            </>
          ) : isStoreDelivery ? (
            <>
              {/* Trip Details for Store Delivery (food, clothes, hardware) */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Trip Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Pickup</span>
                      <p className="text-gray-900 dark:text-white font-medium">{finalPickupText || 'Store'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Destination</span>
                      <p className="text-gray-900 dark:text-white font-medium">{finalDestinationText || 'Not specified'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Details - NO passengers */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Delivery Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Delivery Type</span>
                    <span className="text-gray-900 dark:text-white font-medium">{orderData.deliveryMode?.label || 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* Items */}
              {orderData.items && orderData.items.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                    {isFood || type === 'food' ? 'Food Items' : type === 'clothes' ? 'Clothing Items' : 'Items'} ({orderData.items.length})
                  </h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                        <span className="font-medium text-gray-900 dark:text-white">K {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Subtotal</span>
                  <span className="font-medium text-gray-900 dark:text-white">K {orderData.subtotal || orderData.foodSubtotal || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Delivery fee</span>
                  <span className="font-medium text-gray-900 dark:text-white">K {orderData.deliveryFee || 0}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">K {orderData.totalPrice || 0}</span>
                </div>
              </div>
            </>
          ) : isRide && rideData ? (
            // Ride confirmation display - WITH passengers
            <>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Trip Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Pickup</span>
                      <p className="text-gray-900 dark:text-white font-medium">{finalPickupText}</p>
                    </div>
                  </div>
                  {finalStops.length > 0 && finalStops.map((stop: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 ml-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-1 flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Stop {idx + 1}</span>
                        <p className="text-gray-900 dark:text-white font-medium">{stop}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 bg-[#5B2EFF] rounded-full mt-1 flex-shrink-0"></div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Destination</span>
                      <p className="text-gray-900 dark:text-white font-medium">{finalDestinationText}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ride Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Ride Type</span>
                    <span className="text-gray-900 dark:text-white font-medium">{rideData.name}</span>
                  </div>
                  {/* Passengers - ONLY for rides */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300">Passengers</span>
                    <div className="flex items-center gap-1">
                      <Users size={14} className="text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-900 dark:text-white font-medium">{rideData.seats}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Payment Summary</h3>
                {rideData.originalPrice !== rideData.estimatedPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Original fare</span>
                    <span className="font-medium text-gray-500 dark:text-gray-400 line-through">K {rideData.originalPrice}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Discounted fare</span>
                  <span className="font-medium text-[#5B2EFF]">30% off</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">K {rideData.estimatedPrice}</span>
                </div>
              </div>
            </>
          ) : (
            // Fallback display
            <>
              <div className="text-center py-4">
                <div className="flex items-center justify-center space-x-4">
                  <span className="text-lg font-medium text-gray-700 dark:text-gray-300">{carType}</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">K {price}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* STATIC FOOTEK - Confirm button */}
        <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <motion.button
            onClick={handleConfirmOrder}
            disabled={isLoading || isRideActive}
            className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-colors
              ${isLoading || isRideActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#5B2EFF] text-white hover:bg-[#4A24D9]'}`}
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: isLoading || isRideActive ? 1 : 1.02 }}
          >
            {isLoading ? 'Processing...' : isRideActive ? 'Order Active' : 'Confirm order'}
          </motion.button>
          {isRideActive && (
            <p className="text-gray-500 dark:text-gray-400 text-center text-sm mt-2">
              You have an active order
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
