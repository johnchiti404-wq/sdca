import React, { createContext, useState, useEffect, useContext } from 'react';
import { firebaseService } from '../services/firebaseService';
import { RideRequest } from '../types';

interface RideContextType {
  currentRide: RideRequest | null;
  setCurrentRide: (ride: RideRequest | null) => void;
  isRideActive: boolean;
  rideStatus: string | null;
}

export const RideContext = createContext<RideContextType>({
  currentRide: null,
  setCurrentRide: () => {},
  isRideActive: false,
  rideStatus: null
});

export const useRideContext = () => useContext(RideContext);

interface RideProviderProps {
  rideId: string | null;
  children: React.ReactNode;
}

export const RideProvider: React.FC<RideProviderProps> = ({ rideId, children }) => {
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [rideStatus, setRideStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!rideId) {
      setCurrentRide(null);
      setRideStatus(null);
      return;
    }

    const unsubscribe = firebaseService.listenToRideRequest(rideId, (ride) => {
      setCurrentRide(ride);
      setRideStatus(ride?.status || null);
    });

    return () => unsubscribe();
  }, [rideId]);

  const isRideActive = rideStatus === 'pending' || rideStatus === 'accepted' || rideStatus === 'arrived' || rideStatus === 'in_progress' || rideStatus === 'on_trip';

  return (
    <RideContext.Provider value={{ currentRide, setCurrentRide, isRideActive, rideStatus }}>
      {children}
    </RideContext.Provider>
  );
};
