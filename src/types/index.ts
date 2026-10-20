 export interface RideRequest {
  id: string;
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  timestamp: number;
  status: 'pending' | 'accepted' | 'arrived' | 'rejected' | 'cancelled' | 'started' | 'completed';
  userId: string;
  userName: string;
  driverId?: string;
  driverInfo?: DriverInfo;
  pickupLocation?: {
    latitude: number;
    longitude: number;
  };
  destinationLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface DriverInfo {
  id: string;
  name: string;
  rating: number;
  plateNumber: string;
  carModel: string;
  eta: string;
  photo: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface CarType {
  id: string;
  name: string;
  description: string;
  eta: string;
  price: number;
  originalPrice?: number;
  capacity: number;
  badge?: string;
  icon: string;
}

export interface RecentSearch {
  id: string;
  address: string;
  description: string;
}

export interface SavedPlace {
  id?: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SavedPlaces {
  home?: SavedPlace;
  work?: SavedPlace;
  custom: SavedPlace[];
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  profilePicture?: string;
  savedPlaces?: SavedPlaces;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  sender: 'driver' | 'client';
  senderName?: string;
  text: string;
  timestamp: number;
  read?: boolean;
  readBy?: {
    [userId: string]: boolean;
  };
}

export interface Rating {
  score: number;
  comment: string;
  userId: string;
  timestamp: number;
}

export interface DriverLocation {
  lat: number;
  lng: number;
  timestamp?: number;
}
