 import { CarType, RecentSearch } from '../types';

export const carTypes: CarType[] = [
  {
    id: 'bolt',
    name: 'Bolt',
    description: 'Mid-size cars',
    eta: '1 min',
    price: 0, // Will be calculated dynamically
    originalPrice: 0, // Will be calculated dynamically
    capacity: 3,
    badge: 'FASTER',
    icon: '🚗'
  },
  {
    id: 'economy',
    name: 'Economy',
    description: 'Affordable rides',
    eta: '2 min',
    price: 0, // Will be calculated dynamically
    originalPrice: 0, // Will be calculated dynamically
    capacity: 2,
    badge: 'CHEAPER',
    icon: '🚙'
  },
  {
    id: 'comfort',
    name: 'Comfort',
    description: 'Premium cars',
    eta: '3 min',
    price: 0, // Will be calculated dynamically
    originalPrice: 0, // Will be calculated dynamically
    capacity: 4,
    badge: 'LUXURY',
    icon: '🚖'
  },
  {
    id: 'xl',
    name: 'Bolt XL',
    description: 'Extra space',
    eta: '4 min',
    price: 0, // Will be calculated dynamically
    originalPrice: 0, // Will be calculated dynamically
    capacity: 6,
    badge: 'SPACIOUS',
    icon: '🚐'
  }
];

export const recentSearches: RecentSearch[] = [
  {
    id: '1',
    address: '78 Eastwood Street',
    description: 'West Turffontein, Johannesburg'
  },
  {
    id: '2',
    address: 'KFC Gandhi Square',
    description: 'Umnutho House, Eloff Street, Marshalltown...'
  },
  {
    id: '3',
    address: 'Johannesburg Park Station',
    description: 'Rissik Street, Johannesburg Central'
  },
  {
    id: '4',
    address: 'Mall of Africa',
    description: 'Lone Creek Crescent, Waterfall City'
  },
  {
    id: '5',
    address: 'OR Tambo International Airport',
    description: 'O.R. Tambo Airport Rd, Kempton Park'
  }
];