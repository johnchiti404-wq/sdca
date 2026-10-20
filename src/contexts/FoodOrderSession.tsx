import React, { createContext, useContext, useState, useEffect } from 'react';
import { useOrderSession } from './OrderSessionContext';

export interface FoodItem {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export interface Stop {
  id: string;
  address: string;
  description?: string;
  foodIds: string[];
}

interface FoodOrderSessionContextType {
  cartItems: FoodItem[];
  currentLocationFoodIds: string[];
  stops: Stop[];
  deliveryLocation: string;
  setDeliveryLocation: (location: string) => void;
  addStop: (stop: Stop) => void;
  removeStop: (stopId: string) => void;
  updateStop: (stopId: string, updates: Partial<Stop>) => void;
  canAddStop: () => boolean;
  getCurrentLocationFoods: () => FoodItem[];
  removeStopsWithoutFoodOrAddress: () => void;
  setDeliveryMode: (modeId: string, fee: number) => void;
}

const FoodOrderSessionContext = createContext<FoodOrderSessionContextType | undefined>(undefined);

const STORAGE_KEY = 'FOOD_ORDER_SESSION';

// Safely read + parse the persisted session. Returns {} if storage is empty or
// holds corrupt/partial JSON, so a bad value never throws
// "SyntaxError: Unexpected end of input" during render.
function readStoredSession(): any {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || !stored.trim()) return {};
    return JSON.parse(stored) ?? {};
  } catch {
    return {};
  }
}

function FoodOrderSessionProviderInner({ children }: { children: React.ReactNode }) {
  const { orderSession } = useOrderSession();
  const [currentLocationFoodIds, setCurrentLocationFoodIds] = useState<string[]>(
    () => readStoredSession().currentLocationFoodIds || []
  );

  const [stops, setStops] = useState<Stop[]>(
    () => readStoredSession().stops || []
  );

  const [deliveryLocation, setDeliveryLocation] = useState<string>(
    () => readStoredSession().deliveryLocation || ''
  );

  const cartItems: FoodItem[] = (orderSession.cartItems || []).map(item => ({
    id: item.id,
    storeId: item.storeId,
    storeName: item.storeName,
    name: item.name,
    image: item.image,
    price: item.price,
    quantity: item.quantity,
  }));

  useEffect(() => {
    if (cartItems.length > 0 && currentLocationFoodIds.length === 0) {
      const allItemIds = cartItems.map(item => item.id);
      setCurrentLocationFoodIds(allItemIds);
    }
  }, [cartItems.length]);

  useEffect(() => {
    const data = {
      currentLocationFoodIds,
      stops,
      deliveryLocation,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [currentLocationFoodIds, stops, deliveryLocation]);

  const addFoodToCurrentLocation = (foodId: string) => {
    setCurrentLocationFoodIds(prev => [...new Set([...prev, foodId])]);
  };

  const removeFoodFromCurrentLocation = (foodId: string) => {
    setCurrentLocationFoodIds(prev => prev.filter(id => id !== foodId));
  };

  const addStop = (stop: Stop) => {
    setStops(prev => [...prev, stop]);
  };

  const removeStop = (stopId: string) => {
    setStops(prev => prev.filter(s => s.id !== stopId));
  };

  const updateStop = (stopId: string, updates: Partial<Stop>) => {
    setStops(prev =>
      prev.map(stop =>
        stop.id === stopId ? { ...stop, ...updates } : stop
      )
    );
  };

  const canAddStop = () => {
    return stops.length < 5;
  };

  const getCurrentLocationFoods = () => {
    return cartItems.filter(item => currentLocationFoodIds.includes(item.id));
  };

  const removeStopsWithoutFoodOrAddress = () => {
    setStops(prev =>
      prev.filter(stop => stop.foodIds.length > 0 && stop.address.trim() !== '')
    );
  };

  const setDeliveryMode = (modeId: string, fee: number) => {
    console.log('Delivery mode set:', modeId, 'Fee:', fee);
  };

  const value: FoodOrderSessionContextType = {
    cartItems,
    currentLocationFoodIds,
    stops,
    deliveryLocation,
    setDeliveryLocation,
    addStop,
    removeStop,
    updateStop,
    canAddStop,
    getCurrentLocationFoods,
    removeStopsWithoutFoodOrAddress,
    setDeliveryMode,
  };

  return (
    <FoodOrderSessionContext.Provider value={value}>
      {children}
    </FoodOrderSessionContext.Provider>
  );
}

export function FoodOrderSessionProvider({ children }: { children: React.ReactNode }) {
  return <FoodOrderSessionProviderInner>{children}</FoodOrderSessionProviderInner>;
}

export function useFoodOrderSession() {
  const context = useContext(FoodOrderSessionContext);
  if (context === undefined) {
    throw new Error('useFoodOrderSession must be used within a FoodOrderSessionProvider');
  }
  return context;
}
