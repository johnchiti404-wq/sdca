import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';

export function useRideState(userId: string | null) {
  const navigate = useNavigate();
  const [currentRideId, setCurrentRideId] = useState<string | null>(
    localStorage.getItem('currentRideId')
  );
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [isActiveRide, setIsActiveRide] = useState(false);

  useEffect(() => {
    if (!currentRideId) return;

    const unsubscribe = firebaseService.listenToRideStatus(currentRideId, (statusData) => {
      if (!statusData) return;

      const status = statusData.status;
      setRideStatus(status);

      const active = ['accepted', 'arrived', 'on_trip', 'in_progress'].includes(status);
      setIsActiveRide(active);

      if (active) {
        navigate('/driver-coming');
      }

      if (['completed', 'cancelled'].includes(status)) {
        localStorage.removeItem('currentRideId');
        setIsActiveRide(false);
        setCurrentRideId(null);
      }
    });

    return () => unsubscribe();
  }, [currentRideId, navigate]);

  useEffect(() => {
    const storedRideId = localStorage.getItem('currentRideId');
    if (storedRideId && storedRideId !== currentRideId) {
      setCurrentRideId(storedRideId);
    }
  }, []);

  const setRideId = (rideId: string | null) => {
    setCurrentRideId(rideId);
    if (rideId) {
      localStorage.setItem('currentRideId', rideId);
    } else {
      localStorage.removeItem('currentRideId');
    }
  };

  return { currentRideId, rideStatus, isActiveRide, setRideId };
}
