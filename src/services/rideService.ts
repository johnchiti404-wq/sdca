import { db, database } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  serverTimestamp,
  onSnapshot,
  DocumentData
} from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { calculateDistance } from '../utils/etaCalculation';

// Display name mapping for pricing types
export const PRICING_DISPLAY_NAMES: Record<string, string> = {
  'ride_economy': 'Economy',
  'ride_comfort': 'Comfort',
  'ride_women': 'Women to Women',
  'ride_xl': 'XL',
  'aletwende': 'Aletwende'
};

// Vehicle category mapping for pricing types (CRITICAL)
// pricing → vehicle_service_rules → vehicleRef → vehicles_master → vehicleCategory
export const PRICING_TO_VEHICLE_CATEGORY: Record<string, string> = {
  'ride_economy': 'car',
  'ride_comfort': 'car',
  'ride_women': 'car',
  'ride_xl': 'minibus',
  'aletwende': 'car'
};

// Types
export interface PricingConfig {
  id: string;
  name: string;
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  vehicleCategory?: string;
}

export interface VehicleServiceRule {
  id: string;
  vehicleRef: string;
  allowedPricingTypes: string[]; // CORRECT field name from Firestore
  services: string[];
}

export interface VehicleMaster {
  id: string;
  vehicleCategory: string;
  maxSeats: number;
  brand?: string;
  model?: string;
}

export interface OnlineDriver {
  driverId: string;
  vehicleCategory: string;
  vehicleColor?: string;
  isOnline: boolean;
  isBusy: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface RideOption {
  id: string;
  pricingId: string;
  name: string;
  displayName: string;
  estimatedPrice: number;
  originalPrice: number;
  eta: string;
  etaMinutes: number;
  vehicleCategory: string;
  seats: number;
  isAvailable: boolean;
  nearestDriverId?: string;
}

export interface RideRequestData {
  userId: string;
  userName: string;
  userEmail?: string;
  pickupLocation: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  destinationLocation: {
    address: string;
    latitude: number | null;
    longitude: number | null;
  };
  stops?: string[];
  pricingId: string;
  service: string;
  status: 'pending' | 'accepted' | 'arrived' | 'started' | 'completed' | 'cancelled';
  estimatedPrice: number;
  vehicleCategory: string;
  seats: number;
  createdAt?: any;
}

class RideService {
  // Cache for pricing data
  private pricingCache: Map<string, PricingConfig> = new Map();
  private vehicleRulesCache: VehicleServiceRule[] = [];
  private vehiclesCache: Map<string, VehicleMaster> = new Map();
  private onlineDriversCache: Map<string, OnlineDriver> = new Map();
  private driverLocationsCache: Map<string, { lat: number; lng: number }> = new Map();
  
  // Listeners
  private driversListener: (() => void) | null = null;
  private locationsListener: (() => void) | null = null;

  /**
   * Fetch vehicle service rules where services array contains "ride"
   */
  async fetchVehicleServiceRules(): Promise<VehicleServiceRule[]> {
    try {
      const rulesRef = collection(db, 'vehicle_service_rules');
      const q = query(rulesRef, where('services', 'array-contains', 'ride'));
      const snapshot = await getDocs(q);
      
      console.log('[v0] Raw vehicle_service_rules snapshot:', snapshot.docs.length, 'docs');
      
      this.vehicleRulesCache = snapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log('[v0] Rule doc:', doc.id, data);
          
          // Safe data access - ensure required fields exist
          const allowedPricingTypes = data.allowedPricingTypes;
          if (!allowedPricingTypes || !Array.isArray(allowedPricingTypes)) {
            console.warn('[v0] Skipping rule - missing or invalid allowedPricingTypes:', doc.id);
            return null;
          }
          
          if (!data.vehicleRef) {
            console.warn('[v0] Skipping rule - missing vehicleRef:', doc.id);
            return null;
          }
          
          return {
            id: doc.id,
            vehicleRef: data.vehicleRef,
            allowedPricingTypes: allowedPricingTypes,
            services: data.services || []
          } as VehicleServiceRule;
        })
        .filter((rule): rule is VehicleServiceRule => rule !== null);
      
      console.log('[v0] Processed vehicle rules:', this.vehicleRulesCache);
      return this.vehicleRulesCache;
    } catch (error) {
      console.error('[v0] Error fetching vehicle service rules:', error);
      return [];
    }
  }

  /**
   * Fetch vehicle master data by reference ID
   */
  async fetchVehicleMaster(vehicleId: string): Promise<VehicleMaster | null> {
    // Check cache first
    if (this.vehiclesCache.has(vehicleId)) {
      return this.vehiclesCache.get(vehicleId)!;
    }

    try {
      const vehicleRef = doc(db, 'vehicles_master', vehicleId);
      const snapshot = await getDoc(vehicleRef);
      
      if (snapshot.exists()) {
        const vehicle: VehicleMaster = {
          id: snapshot.id,
          ...snapshot.data() as Omit<VehicleMaster, 'id'>
        };
        this.vehiclesCache.set(vehicleId, vehicle);
        return vehicle;
      }
      return null;
    } catch (error) {
      console.error('Error fetching vehicle master:', error);
      return null;
    }
  }

  /**
   * Fetch pricing config by ID
   * Only returns pricing if active === true
   */
  async fetchPricingConfig(pricingId: string): Promise<PricingConfig | null> {
    // Check cache first
    if (this.pricingCache.has(pricingId)) {
      return this.pricingCache.get(pricingId)!;
    }

    try {
      const pricingRef = doc(db, 'pricing', pricingId);
      const snapshot = await getDoc(pricingRef);
      
      console.log('[v0] Pricing fetch for', pricingId, ':', snapshot.exists() ? snapshot.data() : 'NOT FOUND');
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Only include active pricing
        if (data.active === false) {
          console.log('[v0] Skipping inactive pricing:', pricingId);
          return null;
        }
        
        const pricing: PricingConfig = {
          id: snapshot.id,
          name: data.name || pricingId,
          baseFare: data.baseFare ?? 0,
          pricePerKm: data.pricePerKm ?? 0,
          pricePerMinute: data.pricePerMinute ?? 0,
          minimumFare: data.minimumFare ?? 0,
          vehicleCategory: data.vehicleCategory
        };
        this.pricingCache.set(pricingId, pricing);
        return pricing;
      }
      return null;
    } catch (error) {
      console.error('[v0] Error fetching pricing config:', pricingId, error);
      return null;
    }
  }

  /**
   * Calculate price based on pricing config and distance
   */
  calculatePrice(pricing: PricingConfig, distanceKm: number, durationMinutes: number): number {
    const distancePrice = pricing.pricePerKm * distanceKm;
    const timePrice = pricing.pricePerMinute * durationMinutes;
    const calculatedPrice = pricing.baseFare + distancePrice + timePrice;
    
    return Math.max(Math.round(calculatedPrice), pricing.minimumFare);
  }

  /**
   * Start listening to online drivers (Realtime DB)
   * Fail-safe: returns empty map if collection doesn't exist
   */
  startDriversListener(callback: (drivers: Map<string, OnlineDriver>) => void): () => void {
    try {
      const driversRef = ref(database, 'drivers_online');
      
      const unsubscribe = onValue(driversRef, (snapshot) => {
        const data = snapshot.val();
        this.onlineDriversCache.clear();
        
        console.log('[v0] drivers_online data:', data ? Object.keys(data).length + ' drivers' : 'empty/null');
        
        if (data) {
          Object.entries(data).forEach(([driverId, driverData]) => {
            const driver = driverData as any;
            if (driver && driver.isOnline === true && driver.isBusy === false) {
              this.onlineDriversCache.set(driverId, {
                driverId,
                vehicleCategory: driver.vehicleCategory || '',
                vehicleColor: driver.color || driver.vehicleColor || driver.vehicle?.color || undefined,
                isOnline: driver.isOnline,
                isBusy: driver.isBusy
              });
            }
          });
        }
        
        console.log('[v0] Available drivers:', this.onlineDriversCache.size);
        callback(this.onlineDriversCache);
      }, (error) => {
        console.error('[v0] Error listening to drivers_online:', error);
        // Return empty on error - don't crash
        callback(new Map());
      });

      this.driversListener = () => off(driversRef, 'value', unsubscribe);
      return this.driversListener;
    } catch (error) {
      console.error('[v0] Failed to set up drivers listener:', error);
      // Return a no-op cleanup function
      return () => {};
    }
  }

  /**
   * Start listening to driver locations (Realtime DB)
   * Fail-safe: returns empty map if collection doesn't exist
   */
  startLocationsListener(callback: (locations: Map<string, { lat: number; lng: number }>) => void): () => void {
    try {
      const locationsRef = ref(database, 'driver_locations');
      
      const unsubscribe = onValue(locationsRef, (snapshot) => {
        const data = snapshot.val();
        this.driverLocationsCache.clear();
        
        console.log('[v0] driver_locations data:', data ? Object.keys(data).length + ' locations' : 'empty/null');
        
        if (data) {
          Object.entries(data).forEach(([driverId, locationData]) => {
            const loc = locationData as any;
            // Handle GeoFire format: { l: [lat, lng], g: geohash }
            if (loc && loc.l && Array.isArray(loc.l) && loc.l.length >= 2) {
              this.driverLocationsCache.set(driverId, {
                lat: loc.l[0],
                lng: loc.l[1]
              });
            } else if (loc && loc.lat !== undefined && loc.lng !== undefined) {
              this.driverLocationsCache.set(driverId, {
                lat: loc.lat,
                lng: loc.lng
              });
            }
          });
        }
        
        console.log('[v0] Driver locations cached:', this.driverLocationsCache.size);
        callback(this.driverLocationsCache);
      }, (error) => {
        console.error('[v0] Error listening to driver_locations:', error);
        // Return empty on error - don't crash
        callback(new Map());
      });

      this.locationsListener = () => off(locationsRef, 'value', unsubscribe);
      return this.locationsListener;
    } catch (error) {
      console.error('[v0] Failed to set up locations listener:', error);
      // Return a no-op cleanup function
      return () => {};
    }
  }

  /**
   * Find all matching drivers for a vehicle category
   * Returns array sorted by distance (closest first)
   */
  findMatchingDrivers(
    requiredVehicleCategory: string,
    pickupLat: number,
    pickupLng: number
  ): { driverId: string; distance: number; etaMinutes: number }[] {
    const matchingDrivers: { driverId: string; distance: number; etaMinutes: number }[] = [];

    console.log('[v0] Finding drivers for vehicleCategory:', requiredVehicleCategory);
    console.log('[v0] Drivers Online:', Array.from(this.onlineDriversCache.entries()));
    console.log('[v0] Driver Locations:', Array.from(this.driverLocationsCache.entries()));

    this.onlineDriversCache.forEach((driver, driverId) => {
      // CRITICAL: Match driver.vehicleCategory === requiredVehicleCategory
      // ONLY use drivers_online/{uid} and driver_locations/{uid}
      if (driver.vehicleCategory === requiredVehicleCategory) {
        const location = this.driverLocationsCache.get(driverId);
        if (location) {
          // Calculate distance using Haversine formula
          const distance = calculateDistance(pickupLat, pickupLng, location.lat, location.lng);
          // ETA = (distance / 40 km/h) * 60 minutes
          const etaMinutes = Math.max(1, Math.round((distance / 40) * 60));
          
          matchingDrivers.push({ driverId, distance, etaMinutes });
        }
      }
    });

    // Sort by distance (closest first)
    matchingDrivers.sort((a, b) => a.distance - b.distance);

    console.log('[v0] Matching Drivers for', requiredVehicleCategory, ':', matchingDrivers);
    return matchingDrivers;
  }

  /**
   * Find nearest driver for a vehicle category (returns single closest driver)
   */
  findNearestDriver(
    requiredVehicleCategory: string,
    pickupLat: number,
    pickupLng: number
  ): { driverId: string; distance: number; etaMinutes: number } | null {
    const matchingDrivers = this.findMatchingDrivers(requiredVehicleCategory, pickupLat, pickupLng);
    
    if (matchingDrivers.length === 0) {
      return null;
    }

    // Pick the CLOSEST driver only
    const closestDriver = matchingDrivers[0];
    console.log('[v0] Selected Driver:', closestDriver);
    return closestDriver;
  }

  /**
   * Build ride options from Firestore data + Realtime driver data
   * CRITICAL: Returns ONLY ONE card per pricingId (no duplicates)
   */
  async buildRideOptions(
    pickupLat: number | null,
    pickupLng: number | null,
    destinationLat: number | null,
    destinationLng: number | null,
    discountPercent: number = 0
  ): Promise<RideOption[]> {
    try {
      // Fetch vehicle service rules for "ride" service
      const vehicleRules = await this.fetchVehicleServiceRules();
      console.log('[v0] Rules:', vehicleRules);

      // Calculate trip distance (approximate)
      let tripDistanceKm = 8; // Default
      let tripDurationMinutes = 15; // Default
      
      if (pickupLat && pickupLng && destinationLat && destinationLng) {
        tripDistanceKm = calculateDistance(pickupLat, pickupLng, destinationLat, destinationLng);
        tripDurationMinutes = Math.round((tripDistanceKm / 40) * 60); // 40 km/h average
      }

      // CRITICAL: Group by pricingId to avoid duplicate cards
      // Map: pricingId -> { candidates: RideOption[], bestOption: RideOption | null }
      const pricingOptionsMap = new Map<string, {
        candidates: Array<{
          option: RideOption;
          vehicle: VehicleMaster;
          nearestDriver: { driverId: string; distance: number; etaMinutes: number } | null;
        }>;
      }>();

      const allVehicles: VehicleMaster[] = [];
      
      // Process each vehicle rule
      for (const rule of vehicleRules) {
        console.log('[v0] PricingTypes for rule', rule.id, ':', rule.allowedPricingTypes);
        
        // Fetch vehicle master data
        const vehicle = await this.fetchVehicleMaster(rule.vehicleRef);
        if (!vehicle) {
          console.log('[v0] Vehicle not found for ref:', rule.vehicleRef);
          continue;
        }
        allVehicles.push(vehicle);

        // Process each pricing type for this vehicle - use allowedPricingTypes (NOT pricingTypes)
        for (const pricingId of rule.allowedPricingTypes) {
          const pricing = await this.fetchPricingConfig(pricingId);
          if (!pricing) continue;

          // Get the required vehicle category from the mapping
          const requiredVehicleCategory = PRICING_TO_VEHICLE_CATEGORY[pricingId] || vehicle.vehicleCategory;

          // Calculate estimated price
          const fullPrice = this.calculatePrice(pricing, tripDistanceKm, tripDurationMinutes);
          const discountedPrice = discountPercent > 0 
            ? Math.round(fullPrice * (1 - discountPercent / 100))
            : fullPrice;

          // Find nearest available driver using CORRECT vehicle category matching
          const nearestDriver = pickupLat && pickupLng 
            ? this.findNearestDriver(requiredVehicleCategory, pickupLat, pickupLng)
            : null;

          const isAvailable = nearestDriver !== null;
          const etaMinutes = nearestDriver?.etaMinutes || 0;

          const option: RideOption = {
            id: pricingId, // Use pricingId as the ID to ensure uniqueness
            pricingId,
            name: pricing.name || pricingId,
            displayName: PRICING_DISPLAY_NAMES[pricingId] || pricing.name || pricingId,
            estimatedPrice: discountedPrice,
            originalPrice: fullPrice,
            eta: isAvailable ? `${etaMinutes} min` : 'No drivers',
            etaMinutes,
            vehicleCategory: requiredVehicleCategory,
            seats: vehicle.maxSeats, // Dynamic seats from the vehicle
            isAvailable,
            nearestDriverId: nearestDriver?.driverId
          };

          // Add to the map for this pricingId
          if (!pricingOptionsMap.has(pricingId)) {
            pricingOptionsMap.set(pricingId, { candidates: [] });
          }
          pricingOptionsMap.get(pricingId)!.candidates.push({
            option,
            vehicle,
            nearestDriver
          });
        }
      }

      console.log('[v0] Vehicles:', allVehicles);

      // CRITICAL: Select only ONE BEST option per pricingId
      // Priority: available drivers > lowest ETA > first found
      const finalRideOptions: RideOption[] = [];

      pricingOptionsMap.forEach((data, pricingId) => {
        const { candidates } = data;
        if (candidates.length === 0) return;

        // Sort candidates: available first, then by lowest ETA
        candidates.sort((a, b) => {
          // Available drivers first
          if (a.nearestDriver && !b.nearestDriver) return -1;
          if (!a.nearestDriver && b.nearestDriver) return 1;
          // Then by ETA (lowest first)
          if (a.nearestDriver && b.nearestDriver) {
            return a.nearestDriver.etaMinutes - b.nearestDriver.etaMinutes;
          }
          return 0;
        });

        // Pick the BEST option (first after sorting)
        const best = candidates[0];
        finalRideOptions.push(best.option);
        
        console.log('[v0] Selected best option for', pricingId, ':', best.option);
      });

      console.log('[v0] Final RideOptions (deduplicated):', finalRideOptions);

      // Sort by availability first, then by price
      finalRideOptions.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return a.estimatedPrice - b.estimatedPrice;
      });

      return finalRideOptions;
    } catch (error) {
      // Log error but don't crash - return empty array
      console.error('[v0] Error building ride options:', error);
      return [];
    }
  }

  /**
   * @deprecated Use createOrder from orderService instead
   * This method is kept for backward compatibility but should not be used
   * All new orders should go through the unified orders collection
   */
  async createRideRequest(_data: RideRequestData): Promise<string> {
    console.warn('[v0] DEPRECATED: createRideRequest is deprecated. Use createOrder from orderService instead.');
    throw new Error('createRideRequest is deprecated. Use createOrder from orderService instead.');
  }

  /**
   * Listen to ride status changes in Firestore
   */
  listenToRide(
    rideId: string,
    callback: (rideData: DocumentData | null) => void
  ): () => void {
    const rideRef = doc(db, 'rides', rideId);
    
    const unsubscribe = onSnapshot(rideRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });

    return unsubscribe;
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    if (this.driversListener) {
      this.driversListener();
      this.driversListener = null;
    }
    if (this.locationsListener) {
      this.locationsListener();
      this.locationsListener = null;
    }
  }
}

export const rideService = new RideService();
