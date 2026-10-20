import { useEffect, useMemo, useState } from 'react';
import { rideService } from '../services/rideService';
import { calculateDistance } from '../utils/etaCalculation';
import type { MapMarker } from '../components/MapLibreMap';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const MAX_DISTANCE_KM = 5;

export const useNearbyDrivers = (latitude: number | null, longitude: number | null): MapMarker[] => {
  const [onlineDrivers, setOnlineDrivers] = useState(new Map<string, { vehicleCategory: string; vehicleColor?: string }>());
  const [locations, setLocations] = useState(new Map<string, { lat: number; lng: number }>());
  const [profileColors, setProfileColors] = useState(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    const missingIds = Array.from(onlineDrivers.entries())
      .filter(([id, driver]) => !driver.vehicleColor && !profileColors.has(id))
      .map(([id]) => id);

    if (missingIds.length > 0) {
      Promise.all(missingIds.map(async (driverId) => {
        const driverSnapshot = await getDoc(doc(db, 'drivers', driverId));
        const userSnapshot = driverSnapshot.exists() ? driverSnapshot : await getDoc(doc(db, 'users', driverId));
        const data = userSnapshot.exists() ? userSnapshot.data() : null;
        const color = data?.color ?? data?.vehicle?.color ?? data?.vehicleColor;
        return typeof color === 'string' && color.trim() ? [driverId, color.trim()] as const : null;
      })).then((results) => {
        if (cancelled) return;
        setProfileColors((previous) => {
          const next = new Map(previous);
          results.forEach((result) => { if (result) next.set(result[0], result[1]); });
          return next;
        });
      }).catch(() => undefined);
    }

    return () => { cancelled = true; };
  }, [onlineDrivers]);

  useEffect(() => {
    const stopDrivers = rideService.startDriversListener((drivers) => {
      setOnlineDrivers(new Map(Array.from(drivers.entries()).map(([id, driver]) => [id, { vehicleCategory: driver.vehicleCategory, vehicleColor: driver.vehicleColor }])));
    });
    const stopLocations = rideService.startLocationsListener((nextLocations) => {
      setLocations(new Map(nextLocations));
    });
    return () => {
      stopDrivers();
      stopLocations();
    };
  }, []);

  return useMemo(() => {
    if (latitude == null || longitude == null) return [];
    return Array.from(onlineDrivers.entries()).flatMap(([driverId, driver]) => {
      const location = locations.get(driverId);
      if (!location || calculateDistance(latitude, longitude, location.lat, location.lng) > MAX_DISTANCE_KM) return [];
      return [{ id: `nearby-driver-${driverId}`, type: 'driver' as const, lat: location.lat, lng: location.lng, label: driver.vehicleCategory, vehicleType: driver.vehicleCategory, vehicleColor: driver.vehicleColor || profileColors.get(driverId) }];
    });
  }, [latitude, longitude, locations, onlineDrivers, profileColors]);
};

export const LUSAKA_DEFAULT = { lat: -15.3875, lng: 28.3228 };

export default useNearbyDrivers;
