/**
 * Order Resolver Service
 * 
 * This service acts as a backend-style resolver layer so UI never talks directly to Firebase.
 * All order-related operations go through this service.
 */

import { Store, Product, StoreCategory } from '../data/storesData';
import { fetchStores, fetchStoresByCategory, fetchProductsByStore } from './storeService';

export type CategoryType = 'food' | 'clothes' | 'hardware' | 'market' | 'small_shop';

export interface OrderPayload {
  category: CategoryType;
  storeId: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  deliveryLocation: string;
  stops?: Array<{
    address: string;
    itemIds: string[];
  }>;
}

export interface OrderStatus {
  orderId: string;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'cancelled';
  estimatedDelivery?: string;
  driverId?: string;
}

/**
 * Get stores by category
 */
export async function getStoresByCategory(category: CategoryType): Promise<Store[]> {
  return fetchStoresByCategory(category as StoreCategory);
}

/**
 * Get products by store ID
 */
export async function getProductsByStore(storeId: string): Promise<Product[]> {
  return fetchProductsByStore(storeId);
}

const ORDERS_KEY = 'ALETWENDE_ORDERS';

/**
 * Safely read the persisted orders array. Returns [] for missing, empty, or
 * corrupt/truncated JSON so a bad localStorage value never throws
 * "SyntaxError: Unexpected end of input".
 */
function readStoredOrders(): any[] {
  try {
    const stored = localStorage.getItem(ORDERS_KEY);
    if (!stored || !stored.trim()) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Create a new order
 */
export async function createOrder(orderPayload: OrderPayload): Promise<{ orderId: string; success: boolean }> {
  // In a real app, this would call firebaseService.createOrder()
  // For now, we'll simulate order creation
  const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store order in localStorage for demo purposes
  const orders = readStoredOrders();
  orders.push({
    ...orderPayload,
    orderId,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  
  return { orderId, success: true };
}

/**
 * Subscribe to order status changes
 */
export function subscribeToOrderStatus(
  orderId: string, 
  callback: (status: OrderStatus) => void
): () => void {
  // In a real app, this would call firebaseService.listenToOrderStatus()
  // For now, we'll simulate with a timer
  
  const statuses: OrderStatus['status'][] = ['pending', 'accepted', 'preparing', 'ready', 'in_transit', 'delivered'];
  let currentIndex = 0;
  
  const interval = setInterval(() => {
    if (currentIndex < statuses.length) {
      callback({
        orderId,
        status: statuses[currentIndex],
        estimatedDelivery: `${15 - currentIndex * 2} mins`
      });
      currentIndex++;
    } else {
      clearInterval(interval);
    }
  }, 5000);
  
  // Return unsubscribe function
  return () => clearInterval(interval);
}

/**
 * Get order by ID
 */
export function getOrderById(orderId: string): OrderPayload | null {
  const orders = readStoredOrders();
  return orders.find((order: any) => order.orderId === orderId) || null;
}

/**
 * Get all orders
 */
export function getAllOrders(): OrderPayload[] {
  return readStoredOrders();
}
