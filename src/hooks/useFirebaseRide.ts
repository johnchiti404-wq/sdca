import { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../services/firebaseService';
import { RideRequest } from '../types';

export const useFirebaseRide = (rideId?: string | null) => {
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    if (!rideId) return;

    const unsubscribe = firebaseService.listenToRideRequest(rideId, (ride) => {
      if (ride) {
        setCurrentRide(ride);

        if (ride.driverId && ride.status === 'accepted') {
          setIsAccepted(true);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [rideId]);

  const createRide = useCallback(async (rideData: Omit<RideRequest, 'id' | 'timestamp'>) => {
    setIsLoading(true);
    try {
      const rideId = await firebaseService.createRideRequest(rideData);

      return rideId;
    } catch (error) {
      console.error('Error creating ride:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelRide = useCallback(async (rideId: string) => {
    try {
      await firebaseService.updateRideStatus(rideId, 'cancelled');
      setCurrentRide(null);
    } catch (error) {
      console.error('Error cancelling ride:', error);
      throw error;
    }
  }, []);

  return {
    currentRide,
    isLoading,
    isAccepted,
    createRide,
    cancelRide
  };
};