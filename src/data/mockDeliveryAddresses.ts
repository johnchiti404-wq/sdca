export interface DeliveryAddress {
  id: string;
  name: string;
  address: string;
  description: string;
}

export const mockDeliveryAddresses: DeliveryAddress[] = [
  {
    id: 'addr-1',
    name: 'Home',
    address: '49 Cornwell Street, West Turffontein',
    description: 'West Turffontein, Johannesburg'
  },
  {
    id: 'addr-2',
    name: 'Office',
    address: '100 Grayston Drive, Sandown',
    description: 'Sandown, Johannesburg'
  },
  {
    id: 'addr-3',
    name: 'Gym',
    address: '45 Pritchard Street, Hillbrow',
    description: 'Hillbrow, Johannesburg'
  },
  {
    id: 'addr-4',
    name: 'Parents',
    address: '123 Main Road, Randburg',
    description: 'Randburg, Johannesburg'
  },
  {
    id: 'addr-5',
    name: 'Friend\'s Place',
    address: '789 Jan Smuts Avenue, Parkwood',
    description: 'Parkwood, Johannesburg'
  },
  {
    id: 'addr-6',
    name: 'Shopping',
    address: '456 Oxford Road, Illovo',
    description: 'Illovo, Johannesburg'
  },
  {
    id: 'addr-7',
    name: 'Brother\'s House',
    address: '234 William Street, Roodepoort',
    description: 'Roodepoort, Johannesburg'
  },
  {
    id: 'addr-8',
    name: 'Restaurant',
    address: '567 4th Avenue, Houghton',
    description: 'Houghton, Johannesburg'
  },
  {
    id: 'addr-9',
    name: 'Park',
    address: '890 Ridge Road, Rosebank',
    description: 'Rosebank, Johannesburg'
  },
];

export const getDeliveryAddressSuggestions = (query: string): DeliveryAddress[] => {
  if (!query.trim()) {
    return mockDeliveryAddresses;
  }

  const lowerQuery = query.toLowerCase();
  return mockDeliveryAddresses.filter(addr =>
    addr.name.toLowerCase().includes(lowerQuery) ||
    addr.address.toLowerCase().includes(lowerQuery) ||
    addr.description.toLowerCase().includes(lowerQuery)
  );
};
