export interface Hardware {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  image: string;
  price: number;
  category: string;
  unit?: string;
}

export const mockHardware: Hardware[] = [
  // BuildMart (store-hardware-1)
  {
    id: 'hardware-1',
    storeId: 'store-hardware-1',
    storeName: 'BuildMart',
    name: 'Cement Bags (50kg)',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 85,
    category: 'Building Materials',
    unit: 'bag'
  },
  {
    id: 'hardware-2',
    storeId: 'store-hardware-1',
    storeName: 'BuildMart',
    name: 'Steel Rods (12mm)',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 120,
    category: 'Steel',
    unit: 'piece'
  },
  {
    id: 'hardware-3',
    storeId: 'store-hardware-1',
    storeName: 'BuildMart',
    name: 'Roofing Sheets',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 350,
    category: 'Roofing',
    unit: 'sheet'
  },
  {
    id: 'hardware-4',
    storeId: 'store-hardware-1',
    storeName: 'BuildMart',
    name: 'Building Sand (Ton)',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 450,
    category: 'Building Materials',
    unit: 'ton'
  },
  // Tool World (store-hardware-2)
  {
    id: 'hardware-5',
    storeId: 'store-hardware-2',
    storeName: 'Tool World',
    name: 'Power Drill',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 580,
    category: 'Power Tools'
  },
  {
    id: 'hardware-6',
    storeId: 'store-hardware-2',
    storeName: 'Tool World',
    name: 'Hammer Set',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 120,
    category: 'Hand Tools'
  },
  {
    id: 'hardware-7',
    storeId: 'store-hardware-2',
    storeName: 'Tool World',
    name: 'Screwdriver Kit',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 85,
    category: 'Hand Tools'
  },
  {
    id: 'hardware-8',
    storeId: 'store-hardware-2',
    storeName: 'Tool World',
    name: 'Circular Saw',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 750,
    category: 'Power Tools'
  },
  // Plumbing Plus (store-hardware-3)
  {
    id: 'hardware-9',
    storeId: 'store-hardware-3',
    storeName: 'Plumbing Plus',
    name: 'PVC Pipes (4 inch)',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 45,
    category: 'Plumbing',
    unit: 'piece'
  },
  {
    id: 'hardware-10',
    storeId: 'store-hardware-3',
    storeName: 'Plumbing Plus',
    name: 'Water Tank (1000L)',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 1200,
    category: 'Plumbing'
  },
  {
    id: 'hardware-11',
    storeId: 'store-hardware-3',
    storeName: 'Plumbing Plus',
    name: 'Kitchen Sink',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 650,
    category: 'Plumbing'
  },
  {
    id: 'hardware-12',
    storeId: 'store-hardware-3',
    storeName: 'Plumbing Plus',
    name: 'Tap Fittings',
    image: 'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 180,
    category: 'Plumbing'
  },
  // Electric Zone (store-hardware-4)
  {
    id: 'hardware-13',
    storeId: 'store-hardware-4',
    storeName: 'Electric Zone',
    name: 'Electric Cable (Roll)',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 280,
    category: 'Electrical',
    unit: 'roll'
  },
  {
    id: 'hardware-14',
    storeId: 'store-hardware-4',
    storeName: 'Electric Zone',
    name: 'Circuit Breaker Box',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 450,
    category: 'Electrical'
  },
  {
    id: 'hardware-15',
    storeId: 'store-hardware-4',
    storeName: 'Electric Zone',
    name: 'LED Light Bulbs (Pack)',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 120,
    category: 'Electrical'
  },
  {
    id: 'hardware-16',
    storeId: 'store-hardware-4',
    storeName: 'Electric Zone',
    name: 'Power Sockets',
    image: 'https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 65,
    category: 'Electrical'
  }
];

export const getHardwareByStore = (storeId: string): Hardware[] => {
  return mockHardware.filter(item => item.storeId === storeId);
};

export const getHardwareById = (hardwareId: string): Hardware | undefined => {
  return mockHardware.find(item => item.id === hardwareId);
};
