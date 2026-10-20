export interface Clothing {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  image: string;
  price: number;
  category: string;
  size?: string;
}

export const mockClothes: Clothing[] = [
  // Fashion Hub (store-clothes-1)
  {
    id: 'clothes-1',
    storeId: 'store-clothes-1',
    storeName: 'Fashion Hub',
    name: 'Classic Cotton T-Shirt',
    image: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 150,
    category: 'T-Shirts'
  },
  {
    id: 'clothes-2',
    storeId: 'store-clothes-1',
    storeName: 'Fashion Hub',
    name: 'Slim Fit Jeans',
    image: 'https://images.pexels.com/photos/1082529/pexels-photo-1082529.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 350,
    category: 'Jeans'
  },
  {
    id: 'clothes-3',
    storeId: 'store-clothes-1',
    storeName: 'Fashion Hub',
    name: 'Casual Hoodie',
    image: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 280,
    category: 'Hoodies'
  },
  {
    id: 'clothes-4',
    storeId: 'store-clothes-1',
    storeName: 'Fashion Hub',
    name: 'Summer Dress',
    image: 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 420,
    category: 'Dresses'
  },
  // Urban Style (store-clothes-2)
  {
    id: 'clothes-5',
    storeId: 'store-clothes-2',
    storeName: 'Urban Style',
    name: 'Leather Jacket',
    image: 'https://images.pexels.com/photos/1124468/pexels-photo-1124468.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 850,
    category: 'Jackets'
  },
  {
    id: 'clothes-6',
    storeId: 'store-clothes-2',
    storeName: 'Urban Style',
    name: 'Graphic Print Tee',
    image: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 180,
    category: 'T-Shirts'
  },
  {
    id: 'clothes-7',
    storeId: 'store-clothes-2',
    storeName: 'Urban Style',
    name: 'Cargo Pants',
    image: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 320,
    category: 'Pants'
  },
  {
    id: 'clothes-8',
    storeId: 'store-clothes-2',
    storeName: 'Urban Style',
    name: 'Denim Jacket',
    image: 'https://images.pexels.com/photos/1082529/pexels-photo-1082529.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 450,
    category: 'Jackets'
  },
  // Elegance Boutique (store-clothes-3)
  {
    id: 'clothes-9',
    storeId: 'store-clothes-3',
    storeName: 'Elegance Boutique',
    name: 'Formal Blazer',
    image: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 650,
    category: 'Blazers'
  },
  {
    id: 'clothes-10',
    storeId: 'store-clothes-3',
    storeName: 'Elegance Boutique',
    name: 'Silk Blouse',
    image: 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 380,
    category: 'Blouses'
  },
  {
    id: 'clothes-11',
    storeId: 'store-clothes-3',
    storeName: 'Elegance Boutique',
    name: 'Dress Pants',
    image: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 420,
    category: 'Pants'
  },
  {
    id: 'clothes-12',
    storeId: 'store-clothes-3',
    storeName: 'Elegance Boutique',
    name: 'Evening Gown',
    image: 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 1200,
    category: 'Dresses'
  },
  // Sporty Gear (store-clothes-4)
  {
    id: 'clothes-13',
    storeId: 'store-clothes-4',
    storeName: 'Sporty Gear',
    name: 'Running Shorts',
    image: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 120,
    category: 'Sportswear'
  },
  {
    id: 'clothes-14',
    storeId: 'store-clothes-4',
    storeName: 'Sporty Gear',
    name: 'Training Tank Top',
    image: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 95,
    category: 'Sportswear'
  },
  {
    id: 'clothes-15',
    storeId: 'store-clothes-4',
    storeName: 'Sporty Gear',
    name: 'Yoga Pants',
    image: 'https://images.pexels.com/photos/1598507/pexels-photo-1598507.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 180,
    category: 'Sportswear'
  },
  {
    id: 'clothes-16',
    storeId: 'store-clothes-4',
    storeName: 'Sporty Gear',
    name: 'Windbreaker',
    image: 'https://images.pexels.com/photos/1124468/pexels-photo-1124468.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 280,
    category: 'Sportswear'
  }
];

export const getClothesByStore = (storeId: string): Clothing[] => {
  return mockClothes.filter(item => item.storeId === storeId);
};

export const getClothingById = (clothingId: string): Clothing | undefined => {
  return mockClothes.find(item => item.id === clothingId);
};
