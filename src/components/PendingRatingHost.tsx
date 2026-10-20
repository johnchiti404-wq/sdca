import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { increment, updateDoc, doc } from 'firebase/firestore';
import { RatingModal } from './RatingModal';
import { db } from '../config/firebase';
import { ActiveOrder, useActiveOrder } from '../hooks/useActiveOrder';
import { markOrderRated } from '../services/orderService';

interface PendingRatingHostProps {
  onOpenChange: (isOpen: boolean) => void;
}

export const PendingRatingHost: React.FC<PendingRatingHostProps> = ({ onOpenChange }) => {
  const { pendingRatingOrder } = useActiveOrder();
  const location = useLocation();
  const shownOrderIds = useRef(new Set<string>());
  const submitted = useRef(false);
  const [visibleOrder, setVisibleOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    const isLiveTrackingPage = location.pathname === '/driver-coming' || location.pathname === '/live-tracking';
    if (!pendingRatingOrder || isLiveTrackingPage || shownOrderIds.current.has(pendingRatingOrder.id)) return;

    shownOrderIds.current.add(pendingRatingOrder.id);
    submitted.current = false;
    setVisibleOrder(pendingRatingOrder);
    onOpenChange(true);
  }, [pendingRatingOrder, location.pathname, onOpenChange]);

  const handleClose = () => {
    const order = visibleOrder;
    setVisibleOrder(null);
    onOpenChange(false);

    if (!order || submitted.current) return;

    const nextPromptCount = Number(order.ratingPromptCount ?? 0) + 1;
    void updateDoc(doc(db, 'orders', order.id), {
      ratingPromptCount: increment(1),
      ...(nextPromptCount >= 3 ? { ratingStatus: 'skipped' } : {}),
    }).catch((error) => console.error('Could not save rating dismissal:', error));
  };

  const handleSubmitted = async () => {
    if (!visibleOrder) return;
    submitted.current = true;
    await markOrderRated(visibleOrder.id);
  };

  if (!visibleOrder) return null;

  const driver = (visibleOrder.driver || {}) as Record<string, unknown>;
  return (
    <RatingModal
      isOpen
      canClose
      onClose={handleClose}
      onSubmitted={handleSubmitted}
      path={visibleOrder.storeId ? 'store_delivery' : 'direct_trip'}
      driverName={String(driver.name || visibleOrder.driverName || 'Driver')}
      driverPhoto={String(driver.photo || driver.profileImage || visibleOrder.driverPhoto || '')}
      driverId={String(driver.id || visibleOrder.driverId || '')}
      orderId={visibleOrder.id}
      storeName={String(visibleOrder.storeName || 'Store')}
      storeImage={String(visibleOrder.storeImage || '')}
      storeId={String(visibleOrder.storeId || '')}
    />
  );
};
