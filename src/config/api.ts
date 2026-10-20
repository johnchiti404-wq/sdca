/**
 * API Configuration
 * Central location for all API endpoints and helpers
 */

// Base URL for the backend API
export const API_BASE = 
  import.meta.env.VITE_API_URL || 
  'https://aletwend-render-backend.onrender.com';

/**
 * Safely parse a fetch Response as JSON.
 *
 * Reads the body as text first so an empty body (a 204, a cold-started backend,
 * or an HTML error page) returns `null` instead of throwing the cryptic
 * "SyntaxError: Unexpected end of input". Returns `null` for empty or
 * unparseable bodies.
 */
export async function safeJson<T = any>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Generic POST helper for API calls.
 *
 * Reads the response as text first and parses it defensively so an empty body
 * (e.g. a 204, a cold-started backend, or an HTML error page) never throws the
 * cryptic "SyntaxError: Unexpected end of input" that crashes callers. On a
 * non-OK status or unparseable body it throws a descriptive Error instead.
 */
export async function apiPost<T = any>(path: string, data: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `Request to ${path} failed with status ${res.status}: ${text.slice(0, 200) || res.statusText}`
    );
  }

  // Empty body — return null instead of throwing on JSON.parse('').
  if (!text.trim()) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Request to ${path} returned a non-JSON response.`);
  }
}

// API Endpoints
export const API_ENDPOINTS = {
  // Main ride options endpoint
  GET_RIDE_OPTIONS: '/getRideOptions',
  
  // Ride endpoints
  RIDE_ESTIMATE: '/ride/estimate',
  RIDE_REQUEST: '/ride/request',
  RIDE_CANCEL: '/ride/cancel',
  
  // Delivery endpoints
  DELIVERY_ESTIMATE: '/delivery/estimate',
  DELIVERY_REQUEST: '/delivery/request',
  
  // Intercity endpoints
  INTERCITY_ESTIMATE: '/intercity/estimate',
  INTERCITY_REQUEST: '/intercity/request',
  
  // Aletwende (shared ride) endpoints
  ALETWENDE_ESTIMATE: '/aletwende/estimate',
  ALETWENDE_REQUEST: '/aletwende/request',
  
  // User endpoints
  USER_PROFILE: '/user/profile',
  USER_PAYMENT_METHODS: '/user/payment-methods',
  
  // Location endpoints
  GEOCODE: '/location/geocode',
  REVERSE_GEOCODE: '/location/reverse-geocode',
  PLACES_AUTOCOMPLETE: '/location/autocomplete',
};

// Payload types for different service types
export interface RidePayload {
  serviceType: 'ride';
  pickup: string;
  destination: string;
  stops: string[];
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface CourierPayload {
  serviceType: 'courier';
  category: 'food' | 'clothes' | 'package';
  kg: string;
  pickup: string;
  destination: string;
  stops: string[];
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface DeliveryPayload {
  serviceType: 'delivery';
  category: 'hardware';
  kg: string;
  pickup: string;
  destination: string;
  stops: string[];
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface TowingPayload {
  serviceType: 'towing';
  vehicleType: string;
  pickup: string;
  destination: string;
  stops: string[];
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface TruckPayload {
  serviceType: 'delivery_truck';
  deliveryType: string;
  pickup: string;
  destination: string;
  stops: string[];
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export type ServicePayload = RidePayload | CourierPayload | DeliveryPayload | TowingPayload | TruckPayload;
