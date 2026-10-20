// Unified Vehicle Configuration System
// Maps vehicle categories to UI display properties

export interface VehicleConfigItem {
  label: string;
  image: string;
}

// Backend response type for ride options
export interface BackendRideOption {
  category: string;
  title: string;
  enabled: boolean;
  eta: number;
  price: number;
  seats: number;
  image: string;
  // Dispatch and vehicle mapping fields
  dispatchService: string;      // e.g., "ride_aletwende", "delivery_motorbike"
  vehicleCategory: string;     // e.g., "car", "minibus", "motorbike", "truck"
  pricingCategory?: string;    // Backend pricing category
  // Truck-specific metadata (returned by backend)
  tonnage?: string;            // e.g., "1.5", "2", "3"
  cargoType?: string;          // e.g., "open", "closed", "refrigerated"
  refrigerationType?: string;  // e.g., "standard", "deep_freeze"
  recommended?: boolean;       // Whether this is the recommended option
  tooHeavy?: boolean;
  capacityKg?: number;
  encodedPolyline?: string | null; // Encoded route polyline for the trip
}

// Maps backend category to the real vehicle category for dispatching
// This is the single source of truth for what vehicle type each category maps to
export const CATEGORY_TO_VEHICLE_CATEGORY: Record<string, string> = {
  // Ride vehicles
  ride_economy: 'car',
  ride_comfort: 'car',
  ride_premium: 'car',
  ride_aletwende: 'car',
  ride_xl: 'minibus',
  ride_xxl: 'minibus',
  ride_women: 'car',

  // Courier/delivery vehicles
  delivery_bicycle: 'bicycle',
  delivery_motorbike: 'motorbike',
  delivery_car: 'car',
  delivery_bakkie: 'bakkie',
  delivery_van: 'van',
  delivery_truck: 'truck',
  delivery_truck_closed: 'truck',
  delivery_truck_flatbed: 'truck',
  delivery_truck_refrigerated: 'truck',
  
  // Hardware path trucks (universal dispatch)
  open_truck: 'truck',
  closed_truck: 'truck',

  // Towing vehicles
  towing: 'tow_truck',
  towing_flatbed: 'tow_truck',
  towing_wheel_lift: 'tow_truck',

  // Legacy mappings (bare category names without prefix)
  economy: 'car',
  comfort: 'car',
  premium: 'car',
  aletwende: 'car',
  xl: 'minibus',
  xxl: 'minibus',
  women: 'car',
  bicycle: 'bicycle',
  motorbike: 'motorbike',
  car: 'car',
  bakkie: 'bakkie',
  van: 'van',
  truck: 'truck',
};

// Maps bare backend category names to their dispatchService prefix
// Backend may return "economy" but dispatchService must be "ride_economy"
export const CATEGORY_TO_DISPATCH_PREFIX: Record<string, string> = {
  // Ride categories
  economy: 'ride',
  comfort: 'ride',
  premium: 'ride',
  aletwende: 'ride',
  xl: 'ride',
  xxl: 'ride',
  women: 'ride',

  // Courier/delivery categories
  bicycle: 'delivery',
  motorbike: 'delivery',
  car: 'delivery',
  bakkie: 'delivery',
  van: 'delivery',
  truck: 'delivery',

  // Towing categories
  flatbed: 'towing',
  wheel_lift: 'towing',
};

// Categories that already include their prefix and should be used as-is
const DISPATCH_PREFIXES = ['ride_', 'delivery_', 'towing_'];

/**
 * Build the dispatchService from a backend category and serviceType context.
 * Backend may return bare names like "economy" but dispatchService must be "ride_economy".
 * If the category already has a prefix (e.g., "ride_economy"), it's returned as-is.
 */
export function buildDispatchService(category: string, serviceType: string): string {
  // If category already has a known prefix, use it as-is
  if (DISPATCH_PREFIXES.some(prefix => category.startsWith(prefix))) {
    return category;
  }

  // Use the serviceType to determine the prefix
  const prefixMap: Record<string, string> = {
    ride: 'ride',
    courier: 'delivery',
    delivery: 'delivery',
    delivery_truck: 'delivery',
    towing: 'towing',
  };

  const prefix = prefixMap[serviceType] || CATEGORY_TO_DISPATCH_PREFIX[category] || serviceType;
  return `${prefix}_${category}`;
}

/**
 * Enrich a BackendRideOption with dispatchService and vehicleCategory
 * Requires serviceType context to build the correct dispatchService prefix
 * Preserves all backend metadata (tonnage, cargoType, refrigerationType, recommended, pricingCategory)
 */
export function enrichRideOption(option: BackendRideOption, serviceType: string): BackendRideOption {
  // For truck options, use the backend-provided dispatchService if available
  const dispatchService = option.dispatchService || buildDispatchService(option.category, serviceType);
  
  return {
    ...option,
    dispatchService,
    vehicleCategory: option.vehicleCategory || CATEGORY_TO_VEHICLE_CATEGORY[option.category] || 'car',
    // Preserve truck-specific metadata from backend
    pricingCategory: option.pricingCategory,
    tonnage: option.tonnage,
    cargoType: option.cargoType,
    refrigerationType: option.refrigerationType,
    recommended: option.recommended,
  };
}

/**
 * Sort options with recommended first, then by enabled status
 */
export function sortOptionsWithRecommendedFirst(options: BackendRideOption[]): BackendRideOption[] {
  return [...options].sort((a, b) => {
    // Recommended comes first
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    // Then enabled comes before disabled
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    return 0;
  });
}

// Single source of truth for all vehicle types
export const VEHICLE_CONFIG: Record<string, VehicleConfigItem> = {
  // Ride vehicles
  ride_economy: { label: 'Economy', image: '/cars/economy.png' },
  ride_comfort: { label: 'Comfort', image: '/cars/comfort.png' },
  ride_premium: { label: 'Premium', image: '/cars/premium.png' },
  ride_aletwende: { label: 'Aletwende', image: '/cars/aletwende.png' },
  ride_xl: { label: 'XL', image: '/cars/xl.png' },
  ride_xxl: { label: 'XXL', image: '/cars/xxl.png' },
  ride_women: { label: 'Women', image: '/cars/xxl.png' },
  
  // Delivery vehicles
  delivery_bicycle: { label: 'Bicycle', image: '/cars/bicycle.png' },
  delivery_motorbike: { label: 'Motorbike', image: '/cars/motorbike.png' },
  delivery_car: { label: 'Delivery Car', image: '/cars/economy.png' },
  delivery_bakkie: { label: 'Bakkie', image: '/cars/bakkie.png' },
  delivery_van: { label: 'Van', image: '/cars/van.png' },
  delivery_truck: { label: 'Truck', image: '/cars/refrigerated_truck.png' },
  delivery_truck_closed: { label: 'Closed Truck', image: '/cars/closed_truck.png' },
  delivery_truck_flatbed: { label: 'Flatbed Truck', image: '/cars/open_truck.png' },
  delivery_truck_refrigerated: { label: 'Refrigerated Truck', image: '/cars/refrigerated_truck.png' },
  
  // Hardware path trucks (universal dispatch)
  open_truck: { label: 'Open Truck', image: '/cars/open_truck.png' },
  closed_truck: { label: 'Closed Truck', image: '/cars/closed_truck.png' },
  
  // Towing vehicles
  towing: { label: 'Towing', image: '/cars/towing.png' },
  towing_flatbed: { label: 'Flatbed Tow', image: '/cars/towing.png' },
  towing_wheel_lift: { label: 'Wheel Lift', image: '/cars/towing.png' },
  
  // Legacy mappings (for backward compatibility)
  economy: { label: 'Economy', image: '/cars/economy.png' },
  comfort: { label: 'Comfort', image: '/cars/comfort.png' },
  premium: { label: 'Premium', image: '/cars/premium.png' },
  aletwende: { label: 'Aletwende', image: '/cars/aletwende.png' },
  xl: { label: 'XL', image: '/cars/xl.png' },
  xxl: { label: 'XXL', image: '/cars/xxl.png' },
  women: { label: 'Women', image: '/cars/xxl.png' },
  bicycle: { label: 'Bicycle', image: '/cars/bicycle.png' },
  motorbike: { label: 'Motorbike', image: '/cars/motorbike.png' },
  car: { label: 'Car', image: '/cars/economy.png' },
  bakkie: { label: 'Bakkie', image: '/cars/bakkie.png' },
  van: { label: 'Van', image: '/cars/van.png' },
  truck: { label: 'Truck', image: '/cars/open_truck.png' },
};

// Service to vehicle category mapping
// Defines which vehicle categories are valid for each service type
export const SERVICE_VEHICLE_MAP: Record<string, string[]> = {
  // Ride service - personal transport
  ride: [
    'ride_economy',
    'ride_comfort', 
    'ride_premium',
    'ride_aletwende',
    'ride_xl',
    'ride_xxl',
    'ride_women',
    // Legacy support
    'economy',
    'comfort',
    'premium',
    'aletwende',
    'xl',
    'xxl',
    'women',
  ],

  // Courier service - food, clothes, packages (used by foodies, clothes, send my package paths)
  courier: [
    'delivery_car',
    'delivery_motorbike',
    'delivery_bicycle',
    // Legacy support
    'car',
    'motorbike',
    'bicycle',
  ],

  // Delivery service - hardware/heavy items (used by hardware path)
  delivery: [
    'delivery_bicycle',
    'delivery_motorbike',
    'delivery_car',
    'delivery_bakkie',
    'delivery_van',
    'delivery_truck',
    // Hardware path trucks (universal dispatch)
    'open_truck',
    'closed_truck',
    // Legacy support
    'bicycle',
    'motorbike',
    'car',
    'open_truck',
    'closed_truck',
    'bakkie',
    'van',
    'truck',
  ],

  // Delivery truck service - truck variants only
  delivery_truck: [
    'delivery_truck',
    'delivery_truck_closed',
    'delivery_truck_flatbed',
    'delivery_truck_refrigerated',
    // Legacy support
    'truck',
  ],

  // Towing service - towing vehicles only
  towing: [
    'towing',
    'towing_flatbed',
    'towing_wheel_lift',
  ],
};

/**
 * Filter backend ride options by service type
 * Only returns options whose category is allowed for the given service
 */
export const filterOptionsByService = (
  options: BackendRideOption[],
  serviceType: string
): BackendRideOption[] => {
  const allowed = SERVICE_VEHICLE_MAP[serviceType] || [];
  
  // If no mapping exists for this service type, return all options
  if (allowed.length === 0) {
    return options;
  }
  
  return options.filter(opt => allowed.includes(opt.category));
};

/**
 * Get vehicle config for a given category
 * Falls back to economy if category not found
 */
export const getVehicleConfig = (category: string): VehicleConfigItem => {
  return VEHICLE_CONFIG[category] || VEHICLE_CONFIG['economy'] || {
    label: category,
    image: '/cars/economy.png',
  };
};
