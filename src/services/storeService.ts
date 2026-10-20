import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Store, Product, StoreCategory, OpeningHours } from '../data/storesData';

// Fetch all stores from Firestore
export const fetchStores = async (): Promise<Store[]> => {
  const storesRef = collection(db, 'stores');
  const snapshot = await getDocs(storesRef);
  
  const stores = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Store[];
  
  return stores;
};

// Fetch stores filtered by category
export const fetchStoresByCategory = async (category: StoreCategory): Promise<Store[]> => {
  const stores = await fetchStores();
  return stores.filter(store => store.category === category);
};

// Fetch a single store by ID
export const fetchStoreById = async (storeId: string): Promise<Store | null> => {
  const stores = await fetchStores();
  return stores.find(store => store.id === storeId) || null;
};

// Fetch products for a specific store
export const fetchProductsByStore = async (storeId: string): Promise<Product[]> => {
  const productsRef = collection(db, 'stores', storeId, 'products');
  const snapshot = await getDocs(productsRef);
  
  const products = snapshot.docs.map(doc => {
    const data = doc.data();
    const imageUrls = Array.isArray(data.imageUrls)
      ? data.imageUrls.filter((image): image is string => typeof image === 'string')
      : undefined;

    return {
      id: doc.id,
      ...data,
      categoryKey: typeof data.categoryKey === 'string' ? data.categoryKey : undefined,
      imageUrls,
      availability: typeof data.availability === 'boolean' ? data.availability : undefined,
    } as Product;
  });

  return products;
};

// Helper function to check if a store is currently open
export const isStoreOpen = (openingHours?: OpeningHours): { isOpen: boolean; nextOpenTime?: string } => {
  if (!openingHours) {
    return { isOpen: true }; // Default to open if no hours specified
  }

  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = days[now.getDay()];
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

  const todayHours = openingHours[currentDay];
  
  if (!todayHours) {
    return { isOpen: false, nextOpenTime: getNextOpenTime(openingHours, now) };
  }

  const [openHour, openMinute] = todayHours.open.split(':').map(Number);
  const [closeHour, closeMinute] = todayHours.close.split(':').map(Number);
  
  const openTime = openHour * 60 + openMinute;
  const closeTime = closeHour * 60 + closeMinute;

  const isOpen = currentTime >= openTime && currentTime < closeTime;

  if (!isOpen) {
    // If closed, get next opening time
    if (currentTime < openTime) {
      // Store opens later today
      return { isOpen: false, nextOpenTime: todayHours.open };
    } else {
      // Store closed for today, get tomorrow's opening time
      return { isOpen: false, nextOpenTime: getNextOpenTime(openingHours, now) };
    }
  }

  return { isOpen: true };
};

// Helper to get the next opening time
const getNextOpenTime = (openingHours: OpeningHours, currentDate: Date): string => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayIndex = currentDate.getDay();
  
  // Check the next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDay = days[nextDayIndex];
    const nextDayHours = openingHours[nextDay];
    
    if (nextDayHours) {
      return nextDayHours.open;
    }
  }
  
  return '08:00'; // Default fallback
};
