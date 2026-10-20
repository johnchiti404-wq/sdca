import { Address } from '../types/orderSession';

export const mockAddresses: Address[] = [
  {
    place_id: 'addr-1',
    description: 'Alexandria Street, Sandringham, Johannesburg',
    geometry: {
      location: { lat: -26.1892, lng: 28.0308 }
    }
  },
  {
    place_id: 'addr-2',
    description: '108 Eloff Street, Marshalltown, Johannesburg',
    geometry: {
      location: { lat: -26.2041, lng: 28.0473 }
    }
  },
  {
    place_id: 'addr-3',
    description: 'Builders Warehouse Glen Eagles, Lois Avenue, Glenanda, Johannesburg',
    geometry: {
      location: { lat: -26.1234, lng: 28.1256 }
    }
  },
  {
    place_id: 'addr-4',
    description: '65 Saint Frusquin Street, Malvern, Johannesburg',
    geometry: {
      location: { lat: -26.1678, lng: 28.0945 }
    }
  },
  {
    place_id: 'addr-5',
    description: '5A Lois Avenue, Glenanda, Johannesburg',
    geometry: {
      location: { lat: -26.1123, lng: 28.1389 }
    }
  },
  {
    place_id: 'addr-6',
    description: 'Sandton City, Sandton, Johannesburg',
    geometry: {
      location: { lat: -26.1089, lng: 28.0566 }
    }
  },
  {
    place_id: 'addr-7',
    description: 'Rosebank Mall, Rosebank, Johannesburg',
    geometry: {
      location: { lat: -26.1356, lng: 28.0639 }
    }
  },
  {
    place_id: 'addr-8',
    description: 'Cresta Shopping Centre, Cresta, Johannesburg',
    geometry: {
      location: { lat: -26.1578, lng: 27.9889 }
    }
  }
];

export const searchAddresses = async (query: string): Promise<Address[]> => {
  if (!query.trim()) {
    return mockAddresses;
  }

  const lowerQuery = query.toLowerCase();
  return mockAddresses.filter(addr =>
    addr.description.toLowerCase().includes(lowerQuery)
  );
};

export const getCurrentLocationAddress = (): Address => {
  return {
    place_id: 'current-location',
    description: 'Current Location',
    geometry: {
      location: { lat: -26.1892, lng: 28.0308 }
    }
  };
};
