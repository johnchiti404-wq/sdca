/**
 * Geo helpers for store distance + estimated travel time on the shop listing.
 */

const EARTH_RADIUS_KM = 6371;
// Average urban driving speed used to turn a distance into a travel-time estimate.
const AVERAGE_SPEED_KMH = 30;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Distance in kilometers between two lat/lng points using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Estimated travel time in whole minutes for a given distance in km.
 * Always returns at least 1 minute when distance is greater than zero.
 */
export function estimateTravelTimeMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  return Math.max(1, Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60));
}
