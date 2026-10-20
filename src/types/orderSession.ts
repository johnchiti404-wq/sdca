export interface Address {
  place_id: string;
  description: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export interface CartItem {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  assignedTo: 'CURRENT' | string;
}

export interface Stop {
  id: string;
  address: Address | null;
  assignedFoodIds: string[];
}

export interface FoodiesRoute {
  primaryLocation: Address | null;
  stops: Stop[];
}

export interface OrderSession {
  orderId: string;
  cartItems: CartItem[];
  foodiesRoute: FoodiesRoute;
}
