import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type DeliveryCategory = 'food' | 'clothes' | 'hardware' | 'market' | 'small_shop';

export interface GlobalCartItem {
  id: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  category: DeliveryCategory;
  name: string;
  image: string;
  price: number;
  unit?: string;
  kg?: number; // Weight in kg from Firestore
}

interface BlockedStoreAttempt {
  currentStoreName: string;
  attemptedStoreName: string;
}

interface GlobalCartContextType {
  cart: GlobalCartItem[];
  // Returns true if the item was added, false if it was blocked (different store)
  addToCart: (item: GlobalCartItem) => boolean;
  removeFromCart: (itemId: string) => void;
  // Remove a single unit of a product by its base product id (the part before "-timestamp")
  decrementProduct: (productId: string) => void;
  // Count how many units of a given base product id are in the cart
  getProductCount: (productId: string) => number;
  clearCart: () => void;
  getCartCount: () => number;
  getTotalKg: () => number;
  getTotalKgExact: () => number;
  getKgRange: () => string;
  // Cross-store guard
  blockedStoreAttempt: BlockedStoreAttempt | null;
  clearBlockedAttempt: () => void;
}

const GlobalCartContext = createContext<GlobalCartContextType | undefined>(undefined);

const STORAGE_KEY = 'GLOBAL_CART';
const STORAGE_TS_KEY = 'GLOBAL_CART_UPDATED_AT';
// Items left untouched for longer than this are automatically discarded.
const CART_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Extract the base product id from a cart item id formatted as "<productId>-<timestamp>"
const baseProductId = (cartItemId: string): string =>
  cartItemId.replace(/-\d+$/, '');

export const GlobalCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<GlobalCartItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ts = Number(localStorage.getItem(STORAGE_TS_KEY) || 0);
    // Discard a stale cart on load (older than the TTL)
    if (stored && ts && Date.now() - ts > CART_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
      return [];
    }
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading cart:', error);
        return [];
      }
    }
    return [];
  });

  const [blockedStoreAttempt, setBlockedStoreAttempt] = useState<BlockedStoreAttempt | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));

    // (Re)arm the 10-minute expiry timer whenever the cart changes
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (cart.length > 0) {
      expiryTimerRef.current = setTimeout(() => {
        setCart([]);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TS_KEY);
        console.log('🗑️ Cart expired after 10 minutes of inactivity');
      }, CART_TTL_MS);
    }

    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [cart]);

  const addToCart = useCallback((item: GlobalCartItem): boolean => {
    // Only items from a single store are allowed in the cart at a time.
    const existing = cart[0];
    if (existing && existing.storeId !== item.storeId) {
      setBlockedStoreAttempt({
        currentStoreName: existing.storeName,
        attemptedStoreName: item.storeName,
      });
      console.warn('⛔ Blocked add from a different store:', item.storeName);
      return false;
    }
    setCart(prev => [...prev, item]);
    console.log('✅ Added to cart:', item.name);
    return true;
  }, [cart]);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    console.log('❌ Removed from cart:', itemId);
  }, []);

  // Remove the most recently added unit of a base product id
  const decrementProduct = useCallback((productId: string) => {
    setCart(prev => {
      // Find the last matching item index
      let lastIndex = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (baseProductId(prev[i].id) === productId) {
          lastIndex = i;
          break;
        }
      }
      if (lastIndex === -1) return prev;
      const next = [...prev];
      next.splice(lastIndex, 1);
      return next;
    });
  }, []);

  const getProductCount = useCallback((productId: string) => {
    return cart.filter(item => baseProductId(item.id) === productId).length;
  }, [cart]);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
    console.log('🗑️ Cart cleared');
  }, []);

  const clearBlockedAttempt = useCallback(() => {
    setBlockedStoreAttempt(null);
  }, []);

  const getCartCount = useCallback(() => {
    return cart.length;
  }, [cart]);

  // Calculate total weight from all cart items
  const getTotalKg = useCallback(() => {
    return cart.reduce((total, item) => total + (item.kg || 0), 0);
  }, [cart]);

  const getTotalKgExact = useCallback(() => {
    const total = cart.reduce((sum, item) => sum + (item.kg || 0), 0);
    return Math.round(total * 100) / 100;
  }, [cart]);

  // Get the kg range string for API calls based on total weight
  const getKgRange = useCallback(() => {
    const totalKg = getTotalKg();
    if (totalKg <= 5) return '0-5kg';
    if (totalKg <= 10) return '5-10kg';
    if (totalKg <= 20) return '10-20kg';
    if (totalKg <= 50) return '20-50kg';
    if (totalKg <= 100) return '50-100kg';
    if (totalKg <= 500) return '100-500kg';
    if (totalKg <= 1000) return '500-1000kg';
    return '1000kg+';
  }, [getTotalKg]);

  const value: GlobalCartContextType = {
    cart,
    addToCart,
    removeFromCart,
    decrementProduct,
    getProductCount,
    clearCart,
    getCartCount,
    getTotalKg,
    getTotalKgExact,
    getKgRange,
    blockedStoreAttempt,
    clearBlockedAttempt,
  };

  return (
    <GlobalCartContext.Provider value={value}>
      {children}
    </GlobalCartContext.Provider>
  );
};

export const useGlobalCart = () => {
  const context = useContext(GlobalCartContext);
  if (context === undefined) {
    throw new Error('useGlobalCart must be used within GlobalCartProvider');
  }
  return context;
};
