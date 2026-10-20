export interface AddressSuggestion {
  id: string;
  address: string;
  description: string;
  distance?: string;
  coords: {
    lat: number;
    lng: number;
  };
}

export const addressSuggestions: AddressSuggestion[] = [
  {
    id: '1',
    address: '78 Eastwood Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km',
    coords: { lat: -26.2377, lng: 28.0473 }
  },
  {
    id: '2',
    address: 'KFC Gandhi Square',
    description: 'Umnutho House, Eloff Street, Marshalltown',
    distance: '2.5 km',
    coords: { lat: -26.2051, lng: 28.0441 }
  },
  {
    id: '3',
    address: '130 Main Street',
    description: 'Marshalltown, Johannesburg',
    distance: '1.8 km',
    coords: { lat: -26.2063, lng: 28.0453 }
  },
  {
    id: '4',
    address: '8 Turf Street',
    description: 'Forest Hill, Johannesburg',
    distance: '3.2 km',
    coords: { lat: -26.2489, lng: 28.0312 }
  },
  {
    id: '5',
    address: 'Johannesburg Park Station',
    description: 'Rissik Street, Johannesburg',
    distance: '2.1 km',
    coords: { lat: -26.1953, lng: 28.0416 }
  },
  {
    id: '6',
    address: 'Mall of Africa',
    description: 'Magwa Crescent, Waterval City, Johannesburg',
    distance: '15.3 km',
    coords: { lat: -26.0163, lng: 28.1068 }
  },
  {
    id: '7',
    address: 'Johannesburg OR Tambo Airport (JNB)',
    description: '1 Jones Road, OR Tambo International Airport',
    distance: '45.2 km',
    coords: { lat: -26.1367, lng: 28.2411 }
  },
  {
    id: '8',
    address: '49 Cornwell Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km',
    coords: { lat: -26.2369, lng: 28.0461 }
  },
  {
    id: '9',
    address: '47 Cornwell Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km',
    coords: { lat: -26.2368, lng: 28.0459 }
  },
  {
    id: '10',
    address: '46 Cornwell Street',
    description: 'West Turffontein, Johannesburg',
    distance: '<1 km',
    coords: { lat: -26.2367, lng: 28.0457 }
  }
];

export const getAddressSuggestions = (query: string): AddressSuggestion[] => {
  if (!query.trim()) return addressSuggestions;
  
  return addressSuggestions.filter(
    suggestion =>
      suggestion.address.toLowerCase().includes(query.toLowerCase()) ||
      suggestion.description.toLowerCase().includes(query.toLowerCase())
  );
};

/**
 * Find coordinates for an address string
 * Returns null if not found in local data
 * Can be easily replaced with a real geocoding API later
 */
export const getCoordinatesForAddress = (address: string): { lat: number; lng: number } | null => {
  const found = addressSuggestions.find(
    s => s.address.toLowerCase() === address.toLowerCase()
  );
  return found ? found.coords : null;
};
