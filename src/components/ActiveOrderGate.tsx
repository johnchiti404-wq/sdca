import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ACTIVE_ORDER_POLICY, buildTrackingState, useActiveOrder } from '../hooks/useActiveOrder';

interface ActiveOrderGateProps {
  isRatingModalOpen?: boolean;
}

export const ActiveOrderGate: React.FC<ActiveOrderGateProps> = ({ isRatingModalOpen = false }) => {
  const { order, orderId, isLoading, pendingRatingOrder } = useActiveOrder();
  const location = useLocation();
  const navigate = useNavigate();
  const checkedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || isRatingModalOpen) return;

    if (!order) {
      if (checkedPathRef.current === location.pathname) return;
      checkedPathRef.current = location.pathname;
      const trackingPaths = ['/waiting-for-driver', '/driver-coming', '/order-tracking', '/live-tracking'];
      if (!trackingPaths.includes(location.pathname)) return;

      const routeOrderId = (location.state as { orderId?: string } | null)?.orderId;
      if (routeOrderId && pendingRatingOrder?.id === routeOrderId) return;
      if (!routeOrderId) {
        navigate('/', { replace: true });
        return;
      }

      void getDoc(doc(db, 'orders', routeOrderId)).then(snapshot => {
        if (checkedPathRef.current !== location.pathname) return;
        const status = snapshot.exists() ? String(snapshot.data().status ?? '') : '';
        if (!snapshot.exists() || ACTIVE_ORDER_POLICY.inactiveStatuses.includes(status as typeof ACTIVE_ORDER_POLICY.inactiveStatuses[number])) {
          navigate('/', { replace: true });
        }
      }).catch(error => {
        console.error('Could not verify the tracked order:', error);
      });
      return;
    }
    if (!orderId) return;

    const isEditingActiveRoute =
      location.pathname === '/your-route' &&
      location.state?.editMode === true &&
      location.state?.orderId === orderId;
    const isAllowedPath =
      location.pathname === '/what-went-wrong' ||
      location.pathname === '/login' ||
      location.pathname === '/auth' ||
      location.pathname.startsWith('/auth/') ||
      location.pathname === '/signup' ||
      location.pathname === '/register';

    if (isEditingActiveRoute || isAllowedPath) return;

    const requiredPath = ACTIVE_ORDER_POLICY.routeForOrder(order);
    const alreadyHasTrackingState =
      location.pathname === requiredPath &&
      location.state?.orderId === orderId &&
      location.state?.orderData;

    if (alreadyHasTrackingState) return;

    navigate(requiredPath, {
      replace: true,
      state: buildTrackingState(order, orderId),
    });
  }, [isLoading, isRatingModalOpen, order, orderId, pendingRatingOrder, location, navigate]);

  return null;
};
