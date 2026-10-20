import { database } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';

export interface DriverLocation {
  lat: number;
  lng: number;
}

export interface OrderData {
  status: string;
  driverId?: string;
  pickupLocation?: {
    latitude: number;
    longitude: number;
  };
  destinationLocation?: {
    latitude: number;
    longitude: number;
  };
  [key: string]: any;
}

export function listenToOrder(
  orderId: string,
  collectionName: string,
  callback: (order: OrderData | null) => void
) {
  const orderRef = ref(database, `${collectionName}/${orderId}`);

  const unsubscribe = onValue(orderRef, (snapshot) => {
    const data = snapshot.val();
    callback(data || null);
  });

  return () => off(orderRef, 'value', unsubscribe);
}

export function listenToDriverLocation(
  driverId: string,
  callback: (location: DriverLocation) => void
) {
  const locationRef = ref(database, `driver_locations/${driverId}`);

  const unsubscribe = onValue(locationRef, (snapshot) => {
    const data = snapshot.val();
    if (!data?.l || !Array.isArray(data.l) || data.l.length < 2) {
      return;
    }

    callback({
      lat: data.l[0],
      lng: data.l[1],
    });
  });

  return () => off(locationRef, 'value', unsubscribe);
}

export function calculateETA(
  driverLocation: DriverLocation,
  targetLocation: { latitude: number; longitude: number }
): number {
  const R = 6371;

  const dLat = (targetLocation.latitude - driverLocation.lat) * Math.PI / 180;
  const dLon = (targetLocation.longitude - driverLocation.lng) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(driverLocation.lat * Math.PI / 180) *
      Math.cos(targetLocation.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  const avgSpeed = 35;
  const etaMinutes = (distance / avgSpeed) * 60;

  return Math.max(1, Math.round(etaMinutes));
}
