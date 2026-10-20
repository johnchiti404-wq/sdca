import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { OrderSession, CartItem, FoodiesRoute, Stop, Address } from '../types/orderSession';

interface OrderSessionContextType {
  orderSession: OrderSession;
  setOrderSession: (session: OrderSession) => void;
  addToCart: (item: Omit<CartItem, 'assignedTo'>) => void;
  removeFromCart: (itemId: string) => void;
  updateRoute: (route: FoodiesRoute) => void;
  updatePrimaryLocation: (address: Address | null) => void;
  addStop: () => void;
  removeStop: (stopId: string) => void;
  assignItemToStop: (itemId: string, stopId: string) => void;
  unassignItemFromStop: (itemId: string, stopId: string) => void;
  updateStopAddress: (stopId: string, address: Address | null) => void;
  getUnassignedItems: () => CartItem[];
  getItemsForStop: (stopId: string) => CartItem[];
  canAddStop: () => boolean;
  cleanStops: () => void;
  isItemAssignedToOtherStop: (itemId: string, stopId: string) => boolean;
  hydrate: () => void;
}

const OrderSessionContext = createContext<OrderSessionContextType | undefined>(undefined);

const STORAGE_KEY = 'ORDER_SESSION';

const createDefaultOrderSession = (): OrderSession => ({
  orderId: `order-${Date.now()}`,
  cartItems: [],
  foodiesRoute: {
    primaryLocation: null,
    stops: []
  }
});

export const OrderSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orderSession, setOrderSession] = useState<OrderSession>(createDefaultOrderSession());

  const hydrate = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) {
      try {
        setOrderSession(JSON.parse(stored));
      } catch (error) {
        console.error('Error hydrating order session:', error);
      }
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderSession));
  }, [orderSession]);

  const addToCart = useCallback((item: Omit<CartItem, 'assignedTo'>) => {
    setOrderSession(prev => ({
      ...prev,
      cartItems: [
        ...prev.cartItems,
        {
          ...item,
          assignedTo: 'CURRENT'
        }
      ]
    }));
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setOrderSession(prev => {
      const updatedItems = prev.cartItems.filter(item => item.id !== itemId);

      const updatedStops = prev.foodiesRoute.stops
        .map(stop => ({
          ...stop,
          assignedFoodIds: stop.assignedFoodIds.filter(id => id !== itemId)
        }))
        .filter(stop => stop.assignedFoodIds.length > 0 || stop.address !== null);

      return {
        ...prev,
        cartItems: updatedItems,
        foodiesRoute: {
          ...prev.foodiesRoute,
          stops: updatedStops
        }
      };
    });
  }, []);

  const updateRoute = useCallback((route: FoodiesRoute) => {
    setOrderSession(prev => ({
      ...prev,
      foodiesRoute: route
    }));
  }, []);

  const updatePrimaryLocation = useCallback((address: Address | null) => {
    setOrderSession(prev => ({
      ...prev,
      foodiesRoute: {
        ...prev.foodiesRoute,
        primaryLocation: address
      }
    }));
  }, []);

  const addStop = useCallback(() => {
    setOrderSession(prev => ({
      ...prev,
      foodiesRoute: {
        ...prev.foodiesRoute,
        stops: [
          ...prev.foodiesRoute.stops,
          {
            id: `stop-${Date.now()}`,
            address: null,
            assignedFoodIds: []
          }
        ]
      }
    }));
  }, []);

  const removeStop = useCallback((stopId: string) => {
    setOrderSession(prev => ({
      ...prev,
      foodiesRoute: {
        ...prev.foodiesRoute,
        stops: prev.foodiesRoute.stops.filter(stop => stop.id !== stopId)
      }
    }));
  }, []);

  const assignItemToStop = useCallback((itemId: string, stopId: string) => {
    setOrderSession(prev => ({
      ...prev,
      cartItems: prev.cartItems.map(item =>
        item.id === itemId ? { ...item, assignedTo: stopId } : item
      ),
      foodiesRoute: {
        ...prev.foodiesRoute,
        stops: prev.foodiesRoute.stops.map(stop =>
          stop.id === stopId && !stop.assignedFoodIds.includes(itemId)
            ? { ...stop, assignedFoodIds: [...stop.assignedFoodIds, itemId] }
            : stop
        )
      }
    }));
  }, []);

  const unassignItemFromStop = useCallback((itemId: string, stopId: string) => {
    setOrderSession(prev => ({
      ...prev,
      cartItems: prev.cartItems.map(item =>
        item.id === itemId ? { ...item, assignedTo: 'CURRENT' } : item
      ),
      foodiesRoute: {
        ...prev.foodiesRoute,
        stops: prev.foodiesRoute.stops.map(stop =>
          stop.id === stopId
            ? { ...stop, assignedFoodIds: stop.assignedFoodIds.filter(id => id !== itemId) }
            : stop
        )
      }
    }));
  }, []);

  const updateStopAddress = useCallback((stopId: string, address: Address | null) => {
    setOrderSession(prev => ({
      ...prev,
      foodiesRoute: {
        ...prev.foodiesRoute,
        stops: prev.foodiesRoute.stops.map(stop =>
          stop.id === stopId ? { ...stop, address } : stop
        )
      }
    }));
  }, []);

  const getUnassignedItems = useCallback((): CartItem[] => {
    return orderSession.cartItems.filter(item => item.assignedTo === 'CURRENT');
  }, [orderSession.cartItems]);

  const getItemsForStop = useCallback((stopId: string): CartItem[] => {
    return orderSession.cartItems.filter(
      item => item.assignedTo === stopId || item.assignedTo === 'CURRENT'
    );
  }, [orderSession.cartItems]);

  const canAddStop = useCallback((): boolean => {
    const unassignedCount = getUnassignedItems().length;
    return unassignedCount > 0;
  }, [getUnassignedItems]);

  const cleanStops = useCallback((): void => {
    setOrderSession(prev => ({
      ...prev,
      foodiesRoute: {
        ...prev.foodiesRoute,
        stops: prev.foodiesRoute.stops.filter(
          stop => stop.assignedFoodIds.length > 0 && stop.address !== null
        )
      }
    }));
  }, []);

  const isItemAssignedToOtherStop = useCallback((itemId: string, stopId: string): boolean => {
    const item = orderSession.cartItems.find(i => i.id === itemId);
    return item ? item.assignedTo !== 'CURRENT' && item.assignedTo !== stopId : false;
  }, [orderSession.cartItems]);

  const value: OrderSessionContextType = {
    orderSession,
    setOrderSession,
    addToCart,
    removeFromCart,
    updateRoute,
    updatePrimaryLocation,
    addStop,
    removeStop,
    assignItemToStop,
    unassignItemFromStop,
    updateStopAddress,
    getUnassignedItems,
    getItemsForStop,
    canAddStop,
    cleanStops,
    isItemAssignedToOtherStop,
    hydrate
  };

  return (
    <OrderSessionContext.Provider value={value}>
      {children}
    </OrderSessionContext.Provider>
  );
};

export const useOrderSession = (): OrderSessionContextType => {
  const context = useContext(OrderSessionContext);
  if (!context) {
    throw new Error('useOrderSession must be used within OrderSessionProvider');
  }
  return context;
};
