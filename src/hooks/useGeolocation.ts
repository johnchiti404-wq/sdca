import { useLocation } from '../contexts/LocationContext';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Backward-compatible adapter over the global LocationProvider.
 *
 * Historically each page ran its own `watchPosition` + reverse-geocode loop via
 * this hook, which meant duplicate GPS watchers, duplicate (and un-throttled)
 * Geoapify calls, and inconsistent address state across pages.
 *
 * It now simply projects the single source of truth exposed by `useLocation`
 * into the original `{ latitude, longitude, address, loading, error }` shape so
 * existing consumers (Dashboard, YourRoute, FoodiesRoute, ...) keep working
 * unchanged while benefiting from the shared, throttled, live location system.
 */
export const useGeolocation = (): GeolocationState => {
  const { latitude, longitude, address, loading, error } = useLocation();

  return {
    latitude,
    longitude,
    address,
    loading,
    error
  };
};
