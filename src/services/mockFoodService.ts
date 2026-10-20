export interface Food {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  image: string;
  price: number;
  category: string;
}

export const mockFoods: Food[] = [
  {
    id: 'food-1',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Fried Chicken & Chips',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 90,
    category: 'Chicken'
  },
  {
    id: 'food-2',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Double Cheese Lion',
    image: 'https://images.pexels.com/photos/2691367/pexels-photo-2691367.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 80,
    category: 'Burgers'
  },
  {
    id: 'food-3',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Lion Burger & Chips',
    image: 'https://images.pexels.com/photos/2089717/pexels-photo-2089717.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 65,
    category: 'Burgers'
  },
  {
    id: 'food-4',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Classic Combo',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 70,
    category: 'Combos'
  },
  {
    id: 'food-5',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Spicy Wings',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 75,
    category: 'Wings'
  },
  {
    id: 'food-6',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Crispy Strips',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 55,
    category: 'Sides'
  },
  {
    id: 'food-7',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Cheesy Fries',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 45,
    category: 'Sides'
  },
  {
    id: 'food-8',
    storeId: 'store-1',
    storeName: 'Hungry Lion',
    name: 'Spicy Burger',
    image: 'https://images.pexels.com/photos/2691367/pexels-photo-2691367.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 75,
    category: 'Burgers'
  },
  {
    id: 'food-9',
    storeId: 'store-2',
    storeName: 'Legana Food Heist',
    name: 'Fresh Oysters',
    image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 120,
    category: 'Seafood'
  },
  {
    id: 'food-10',
    storeId: 'store-2',
    storeName: 'Legana Food Heist',
    name: 'Grilled Fish',
    image: 'https://images.pexels.com/photos/2097090/pexels-photo-2097090.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 110,
    category: 'Seafood'
  },
  {
    id: 'food-11',
    storeId: 'store-2',
    storeName: 'Legana Food Heist',
    name: 'Shrimp Pasta',
    image: 'https://images.pexels.com/photos/1410235/pexels-photo-1410235.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 95,
    category: 'Pasta'
  },
  {
    id: 'food-12',
    storeId: 'store-2',
    storeName: 'Legana Food Heist',
    name: 'Caesar Salad',
    image: 'https://images.pexels.com/photos/1410235/pexels-photo-1410235.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 50,
    category: 'Salads'
  },
  {
    id: 'food-13',
    storeId: 'store-3',
    storeName: 'My Oyster House',
    name: 'Premium Oysters',
    image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 140,
    category: 'Seafood'
  },
  {
    id: 'food-14',
    storeId: 'store-3',
    storeName: 'My Oyster House',
    name: 'Lobster Tail',
    image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 180,
    category: 'Seafood'
  },
  {
    id: 'food-15',
    storeId: 'store-3',
    storeName: 'My Oyster House',
    name: 'Grilled Prawns',
    image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 125,
    category: 'Seafood'
  },
  {
    id: 'food-15b',
    storeId: 'store-3',
    storeName: 'My Oyster House',
    name: 'Seafood Platter',
    image: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 200,
    category: 'Seafood'
  },
  {
    id: 'food-16',
    storeId: 'store-4',
    storeName: 'The Asian Kitchen',
    name: 'Pad Thai',
    image: 'https://images.pexels.com/photos/2455529/pexels-photo-2455529.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 85,
    category: 'Thai'
  },
  {
    id: 'food-17',
    storeId: 'store-4',
    storeName: 'The Asian Kitchen',
    name: 'Fried Rice',
    image: 'https://images.pexels.com/photos/2455529/pexels-photo-2455529.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 75,
    category: 'Rice'
  },
  {
    id: 'food-18',
    storeId: 'store-4',
    storeName: 'The Asian Kitchen',
    name: 'Chicken Noodles',
    image: 'https://images.pexels.com/photos/2455529/pexels-photo-2455529.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 70,
    category: 'Noodles'
  },
  {
    id: 'food-19',
    storeId: 'store-4',
    storeName: 'The Asian Kitchen',
    name: 'Spring Rolls',
    image: 'https://images.pexels.com/photos/2455529/pexels-photo-2455529.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 55,
    category: 'Appetizers'
  },
  {
    id: 'food-20',
    storeId: 'store-5',
    storeName: "Milla's Pastries",
    name: 'Chocolate Cake',
    image: 'https://images.pexels.com/photos/3296516/pexels-photo-3296516.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 40,
    category: 'Cakes'
  },
  {
    id: 'food-21',
    storeId: 'store-5',
    storeName: "Milla's Pastries",
    name: 'Croissant',
    image: 'https://images.pexels.com/photos/3296516/pexels-photo-3296516.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 25,
    category: 'Pastries'
  },
  {
    id: 'food-22',
    storeId: 'store-5',
    storeName: "Milla's Pastries",
    name: 'Cheese Tart',
    image: 'https://images.pexels.com/photos/3296516/pexels-photo-3296516.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 30,
    category: 'Pastries'
  },
  {
    id: 'food-23',
    storeId: 'store-5',
    storeName: "Milla's Pastries",
    name: 'Tiramisu',
    image: 'https://images.pexels.com/photos/3296516/pexels-photo-3296516.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 35,
    category: 'Desserts'
  },
  {
    id: 'food-24',
    storeId: 'store-6',
    storeName: 'Pizza Palace',
    name: 'Pepperoni Pizza',
    image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 100,
    category: 'Pizza'
  },
  {
    id: 'food-25',
    storeId: 'store-6',
    storeName: 'Pizza Palace',
    name: 'Margherita Pizza',
    image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 85,
    category: 'Pizza'
  },
  {
    id: 'food-26',
    storeId: 'store-6',
    storeName: 'Pizza Palace',
    name: 'Meat Lovers Pizza',
    image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 110,
    category: 'Pizza'
  },
  {
    id: 'food-27',
    storeId: 'store-6',
    storeName: 'Pizza Palace',
    name: 'Garlic Bread',
    image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 40,
    category: 'Sides'
  },
  {
    id: 'food-28',
    storeId: 'store-7',
    storeName: 'Smoothie Bar',
    name: 'Mango Smoothie',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 35,
    category: 'Smoothies'
  },
  {
    id: 'food-29',
    storeId: 'store-7',
    storeName: 'Smoothie Bar',
    name: 'Berry Blast',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 40,
    category: 'Smoothies'
  },
  {
    id: 'food-30',
    storeId: 'store-7',
    storeName: 'Smoothie Bar',
    name: 'Protein Shake',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 45,
    category: 'Shakes'
  },
  {
    id: 'food-31',
    storeId: 'store-7',
    storeName: 'Smoothie Bar',
    name: 'Fresh Orange Juice',
    image: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 25,
    category: 'Juices'
  },
  {
    id: 'food-32',
    storeId: 'store-8',
    storeName: 'Burger Heaven',
    name: 'Classic Burger',
    image: 'https://images.pexels.com/photos/2689714/pexels-photo-2689714.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 70,
    category: 'Burgers'
  },
  {
    id: 'food-33',
    storeId: 'store-8',
    storeName: 'Burger Heaven',
    name: 'Double Bacon Burger',
    image: 'https://images.pexels.com/photos/2689714/pexels-photo-2689714.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 95,
    category: 'Burgers'
  },
  {
    id: 'food-34',
    storeId: 'store-8',
    storeName: 'Burger Heaven',
    name: 'Mushroom Swiss Burger',
    image: 'https://images.pexels.com/photos/2689714/pexels-photo-2689714.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 85,
    category: 'Burgers'
  },
  {
    id: 'food-35',
    storeId: 'store-8',
    storeName: 'Burger Heaven',
    name: 'Loaded Fries',
    image: 'https://images.pexels.com/photos/2689714/pexels-photo-2689714.jpeg?auto=compress&cs=tinysrgb&w=400',
    price: 50,
    category: 'Sides'
  }
];

export const getFoodsByStore = (storeId: string): Food[] => {
  return mockFoods.filter(food => food.storeId === storeId);
};

export const getFoodById = (foodId: string): Food | undefined => {
  return mockFoods.find(food => food.id === foodId);
};
