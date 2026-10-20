import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  Timestamp,
  getDoc
} from 'firebase/firestore';

// Order status types
export type OrderStatus = 
  | 'pending'           // Just created, waiting for driver
  | 'accepted'          // Driver accepted
  | 'arriving'          // Driver is on the way to pickup
  | 'arrived'           // Driver arrived at pickup
  | 'in_progress'       // Trip/delivery in progress (NOT 'started')
  | 'completed'         // Order completed
  | 'cancelled';        // Order cancelled

// Service types supported (matches your exact specification)
export type ServiceType = 
  | 'ride'           // Ride path
  | 'courier'        // Clothes, foodies, and send my package path
  | 'delivery'       // Hardware path
  | 'delivery_truck' // Truck delivery path
  | 'towing';        // Towing path

// Category types for courier and delivery
export type CategoryType = 'food' | 'clothes' | 'package' | 'hardware' | 'market' | 'small_shop';

// Workflow type - determines backend dispatch behavior
export type WorkflowType = 'store_delivery' | 'direct_trip';

// SubType for vehicle class
export type SubType = string; // e.g., "economy", "premium", "motorbike", "flatbed", etc.

// Location structure
export interface OrderLocation {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

// Cart item for delivery orders
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  storeName?: string;
  storeId?: string;
}

// Driver info (populated when driver accepts)
export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  rating?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

// Package-specific details
export interface PackageDetails {
  description: string;
  weight?: string;
  size?: string;
  fragile?: boolean;
  recipientName: string;
  recipientPhone: string;
}

// Towing-specific details
export interface TowingDetails {
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear?: string;
  vehicleColor?: string;
  issue?: string;
  licensePlate?: string;
}

// Truck-specific details
export interface TruckDetails {
  loadDescription: string;
  weight?: string;
  helpers?: number;
  floors?: {
    pickup?: number;
    dropoff?: number;
  };
}

// Unified Order structure (matches your exact specification)
export interface Order {
  id?: string;

  // REQUIRED: Service identification (exact spec)
  serviceType: ServiceType;
  category?: CategoryType;  // Required for courier → "food"|"clothes"|"package", delivery → "hardware"
  subType?: SubType;        // Vehicle class: "economy", "premium", "motorbike", "flatbed", etc.
  selectedVehicle?: string; // pricingCategory
  dispatchService?: string;  // Backend dispatch key, e.g., "ride_aletwende", "delivery_motorbike"
  
  // Locations (exact spec)
  pickupAddress: string;
  destinationAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropLat: number | null;
  dropLng: number | null;
  
  // Legacy location format (for backward compatibility)
  pickup?: OrderLocation;
  dropoff?: OrderLocation;
  stops?: OrderLocation[];
  
  // Store-specific (for food, clothes, hardware)
  items?: CartItem[];
  kg?: string;
  
  // Vehicle/truck specific
  truckType?: string;
  vehicleType?: string;
  
  // Pricing (exact spec)
  fee?: number;
  subtotal?: number;
  total?: number;
  price?: number;
  currency?: string;
  
  // Trip info (exact spec)
  estimatedTime?: number;
  estimatedDuration?: number;
  estimatedDistance?: number;
  
  // Store info (exact spec)
  storeId?: string;
  storeName?: string;
  storeImage?: string;
  storeDistanceKm?: number | null;
  encodedPolyline?: string;
  
  // User info (exact spec)
  userId: string;
  userName?: string;
  userEmail?: string;
  
  // Driver info (exact spec)
  driverId?: string | null;
  driverStatus?: 'waiting' | 'searching' | 'assigned' | 'no_driver_found';
  driver?: DriverInfo;
  
  // Status (exact spec)
  status: OrderStatus;
  
  // Legacy fields for backward compatibility
  vehicleCategory?: string;
  vehicleTitle?: string;
  paymentMethod?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  priceBreakdown?: {
    baseFare: number;
    distance: number;
    time: number;
    surge?: number;
    discount?: number;
    serviceFee?: number;
  };
  
  // Service-specific data
  cartItems?: CartItem[];
  packageDetails?: PackageDetails;
  towingDetails?: TowingDetails;
  truckDetails?: TruckDetails;
  
  // Promo/discount
  promoCode?: string;
  promoDiscount?: number;
  
  // Timestamps
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  acceptedAt?: Timestamp;
  arrivedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  
  // Metadata
  notes?: string;
  rating?: number;
  review?: string;
}

// Input for creating a new order (matches your exact specification)
export interface CreateOrderInput {
  // Required fields
  userId: string;
  userName?: string;
  userEmail?: string;
  serviceType: ServiceType;
  
  // REQUIRED: Workflow type determines backend dispatch behavior
  // "store_delivery" = wait for store ready_for_pickup (food, clothes, hardware)
  // "direct_trip" = dispatch immediately (ride, package, delivery_truck, towing)
  workflowType: WorkflowType;
  
  // Category is REQUIRED for courier and delivery
  category?: CategoryType;
  
  // SubType for vehicle class
  subType?: SubType;
  
  // Selected vehicle (pricingCategory)
  selectedVehicle?: string;

  // Dispatch service key for backend driver matching
  dispatchService?: string;
  
  // Locations (new format)
  pickupAddress: string;
  destinationAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropLat?: number | null;
  dropLng?: number | null;
  
  // Legacy location format (for backward compatibility)
  pickup?: OrderLocation;
  dropoff?: OrderLocation;
  stops?: OrderLocation[];
  
  // Store-specific
  items?: CartItem[];
  kg?: string;
  storeId?: string;
  storeName?: string;
  storeImage?: string;
  storeDistanceKm?: number | null;
  encodedPolyline?: string;
  
  // Vehicle/truck specific
  truckType?: string;
  vehicleType?: string;
  
  // Pricing
  fee?: number;
  subtotal?: number;
  total?: number;
  price?: number;
  currency?: string;
  
  // Trip info
  estimatedTime?: number;
  estimatedDuration?: number;
  estimatedDistance?: number;
  
  // Legacy fields
  vehicleCategory?: string;
  vehicleTitle?: string;
  paymentMethod?: string;
  
  // Service-specific data
  cartItems?: CartItem[];
  packageDetails?: PackageDetails;
  towingDetails?: TowingDetails;
  truckDetails?: TruckDetails;
  
  // Promo
  promoCode?: string;
  promoDiscount?: number;
  notes?: string;
  ratingStatus?: 'pending' | 'rated' | 'skipped';
  ratingPromptCount?: number;
}

/**
 * Create a new order in the unified orders collection
 * Uses the EXACT document structure specified
 */
export async function createOrder(input: CreateOrderInput): Promise<string> {
  // Build the order document with exact structure from specification
  const order: Record<string, unknown> = {
    // Service identification (REQUIRED)
    serviceType: input.serviceType,
    
    // REQUIRED: Workflow type for backend dispatch logic
    workflowType: input.workflowType,
    
    // Category (REQUIRED for courier and delivery)
    ...(input.category && { category: input.category }),
    
    // SubType - vehicle class
    ...(input.subType && { subType: input.subType }),
    
    // Selected vehicle (pricingCategory)
    ...(input.selectedVehicle && { selectedVehicle: input.selectedVehicle }),

    // Dispatch service key for backend driver matching
    ...(input.dispatchService && { dispatchService: input.dispatchService }),
    
    // Locations (exact spec format)
    pickupAddress: input.pickupAddress || input.pickup?.address || '',
    destinationAddress: input.destinationAddress || input.dropoff?.address || '',
    pickupLat: input.pickupLat ?? input.pickup?.lat ?? null,
    pickupLng: input.pickupLng ?? input.pickup?.lng ?? null,
    dropLat: input.dropLat ?? input.dropoff?.lat ?? null,
    dropLng: input.dropLng ?? input.dropoff?.lng ?? null,
    
    // Items for store-based orders (food, clothes, hardware)
    ...(input.items && input.items.length > 0 && { items: input.items }),
    ...(input.cartItems && input.cartItems.length > 0 && { items: input.cartItems }),
    ...(input.kg && { kg: input.kg }),
    
    // Vehicle/truck specific
    ...(input.truckType && { truckType: input.truckType }),
    ...(input.vehicleType && { vehicleType: input.vehicleType }),
    
    // Pricing (exact spec)
    fee: input.fee || input.price || 0,
    subtotal: input.subtotal || 0,
    total: input.total || input.price || 0,
    
    // Trip info
    estimatedTime: input.estimatedTime || input.estimatedDuration || 0,
    
    // Store info
    ...(input.storeId && { storeId: input.storeId }),
    ...(input.storeName && { storeName: input.storeName }),
    ...(input.storeImage && { storeImage: input.storeImage }),
    ...(input.storeDistanceKm != null && { storeDistanceKm: input.storeDistanceKm }),
    ...(input.encodedPolyline && { encodedPolyline: input.encodedPolyline }),
    
    // User info (REQUIRED)
    userId: input.userId,
    ...(input.userName && { userName: input.userName }),
    ...(input.userEmail && { userEmail: input.userEmail }),
    
    // Driver info (initial state)
    driverId: null,
    driverStatus: 'waiting',
    
    // Status (REQUIRED)
    status: 'pending',
    
    // Timestamp
    createdAt: serverTimestamp(),

    ...(input.ratingStatus && { ratingStatus: input.ratingStatus }),
    ...(input.ratingPromptCount !== undefined && { ratingPromptCount: input.ratingPromptCount }),
    
    // Legacy fields for backward compatibility
    ...(input.vehicleCategory && { vehicleCategory: input.vehicleCategory }),
    ...(input.vehicleTitle && { vehicleTitle: input.vehicleTitle }),
    ...(input.paymentMethod && { paymentMethod: input.paymentMethod }),
    ...(input.currency && { currency: input.currency }),
    
    // Service-specific data
    ...(input.packageDetails && { packageDetails: input.packageDetails }),
    ...(input.towingDetails && { towingDetails: input.towingDetails }),
    ...(input.truckDetails && { truckDetails: input.truckDetails }),
    
    // Promo
    ...(input.promoCode && { promoCode: input.promoCode }),
    ...(input.promoDiscount && { promoDiscount: input.promoDiscount }),
    ...(input.notes && { notes: input.notes }),
    
    // Stops if any
    ...(input.stops && input.stops.length > 0 && { stops: input.stops }),
  };

  // Remove undefined and null fields (except driverId which should be null)
  const cleanOrder = Object.fromEntries(
    Object.entries(order).filter(([key, v]) => v !== undefined && (key === 'driverId' || v !== null))
  );

  const docRef = await addDoc(collection(db, 'orders'), cleanOrder);
  return docRef.id;
}

/**
 * Get an order by ID
 */
export async function getOrder(orderId: string): Promise<Order | null> {
  const docRef = doc(db, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as Order;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string, 
  status: OrderStatus,
  additionalData?: Partial<Order>
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  const updateData: Record<string, unknown> = { status, ...additionalData };
  
  // Add timestamp for status changes
  const timestampMap: Record<string, string> = {
    'accepted': 'acceptedAt',
    'arrived': 'arrivedAt',
    'in_progress': 'startedAt',
    'completed': 'completedAt',
    'cancelled': 'cancelledAt',
  };
  
  if (timestampMap[status]) {
    updateData[timestampMap[status]] = serverTimestamp();
  }
  
  await updateDoc(docRef, updateData);
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string, reason?: string): Promise<void> {
  await updateOrderStatus(orderId, 'cancelled', { 
    cancellationReason: reason 
  } as Partial<Order>);
}

/**
 * Subscribe to order updates
 */
export function subscribeToOrder(
  orderId: string,
  callback: (order: Order | null) => void
): () => void {
  const docRef = doc(db, 'orders', orderId);
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Order);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error('Error listening to order:', error);
    callback(null);
  });
}

export async function markOrderRated(orderId: string): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), {
    ratingStatus: 'rated',
    ratedAt: serverTimestamp(),
  });
}

/**
 * Update driver location in order
 */
export async function updateDriverLocation(
  orderId: string,
  location: { lat: number; lng: number }
): Promise<void> {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, {
    'driver.location': location
  });
}

/**
 * Helper to get display text for status
 */
export function getStatusDisplayText(status: OrderStatus, serviceType: ServiceType): string {
  const isDelivery = ['food', 'clothes', 'hardware', 'market', 'small_shop', 'package'].includes(serviceType);
  const isTowing = serviceType === 'towing';
  const isTruck = serviceType === 'truck';
  
  const statusText: Record<OrderStatus, string> = {
    'pending': isDelivery ? 'Finding courier...' : isTowing ? 'Finding tow truck...' : isTruck ? 'Finding truck...' : 'Finding driver...',
    'accepted': isDelivery ? 'Courier accepted' : isTowing ? 'Tow truck assigned' : isTruck ? 'Truck assigned' : 'Driver accepted',
    'arriving': isDelivery ? 'Courier on the way' : isTowing ? 'Tow truck on the way' : isTruck ? 'Truck on the way' : 'Driver on the way',
    'arrived': isDelivery ? 'Courier arrived' : isTowing ? 'Tow truck arrived' : isTruck ? 'Truck arrived' : 'Driver arrived',
    'in_progress': isDelivery ? 'Delivery in progress' : isTowing ? 'Towing in progress' : isTruck ? 'Moving in progress' : 'Trip in progress',
    'completed': isDelivery ? 'Delivered' : isTowing ? 'Towing complete' : isTruck ? 'Moving complete' : 'Trip completed',
    'cancelled': 'Cancelled',
  };
  
  return statusText[status];
}
