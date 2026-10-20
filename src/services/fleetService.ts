// Fleet Resolver Service
// This simulates a backend fleet engine.
// Later this will call Firebase / API instead.

export interface FleetVehicle {
  id: string;
  name: string;
  description: string;
  eta: string;
  price: number;
  originalPrice?: number;
  capacity: number | string;
  badge?: 'RECOMMENDED' | 'FASTER' | 'CHEAPER';
  icon: string;
  category: 'recommended' | 'faster' | 'cheaper';
}

// Service type matrices - defines which vehicles are available for each selection
const truckMatrix: Record<string, string[]> = {
  "house-shifting": ["1 Ton Truck", "3 Ton Truck"],
  "farm-produce": ["Dropside Truck", "3 Ton Truck"],
  "construction-material": ["3 Ton Truck", "4 Ton Truck"],
  "building-sand": ["Tipper Truck", "4 Ton Truck"],
  "furniture": ["1 Ton Truck", "Enclosed Truck"],
  "bulk-goods": ["4 Ton Truck", "Dropside Truck"]
};

const packageMatrix: Record<string, string[]> = {
  "0-5kg": ["Bicycle", "Motorbike", "Car"],
  "5-10kg": ["Motorbike", "Car"],
  "10-20kg": ["Car", "Small Van"],
  "20-50kg": ["Small Van", "Bakkie"]
};

const towingMatrix: Record<string, string[]> = {
  "sedan": ["Flatbed Tow", "Standard Tow"],
  "suv": ["Heavy Duty Tow", "Flatbed Tow"],
  "bakkie": ["Heavy Duty Tow", "Flatbed Tow"],
  "small-truck": ["Industrial Tow", "Heavy Duty Tow"],
  "van": ["Flatbed Tow", "Heavy Duty Tow"]
};

// Vehicle metadata - pricing, capacity, icons, etc.
const vehicleMetadata: Record<string, Partial<FleetVehicle>> = {
  // Trucks
  "1 Ton Truck": {
    icon: "🚚",
    capacity: "1 Ton",
    description: "Small moves",
    price: 180,
    originalPrice: 230
  },
  "3 Ton Truck": {
    icon: "🚛",
    capacity: "3 Tons",
    description: "Medium loads",
    price: 280,
    originalPrice: 350
  },
  "4 Ton Truck": {
    icon: "🚛",
    capacity: "4 Tons",
    description: "Heavy loads",
    price: 380,
    originalPrice: 480
  },
  "Dropside Truck": {
    icon: "🚚",
    capacity: "2.5 Tons",
    description: "Open sided",
    price: 250,
    originalPrice: 310
  },
  "Tipper Truck": {
    icon: "🚛",
    capacity: "5 Tons",
    description: "Tipping bed",
    price: 420,
    originalPrice: 520
  },
  "Enclosed Truck": {
    icon: "🚚",
    capacity: "1.5 Tons",
    description: "Protected cargo",
    price: 220,
    originalPrice: 280
  },

  // Package delivery
  "Bicycle": {
    icon: "🚴",
    capacity: "5kg",
    description: "Eco-friendly",
    price: 25,
    originalPrice: 35
  },
  "Motorbike": {
    icon: "🏍️",
    capacity: "10kg",
    description: "Fast delivery",
    price: 40,
    originalPrice: 55
  },
  "Car": {
    icon: "🚗",
    capacity: "20kg",
    description: "Standard delivery",
    price: 60,
    originalPrice: 80
  },
  "Small Van": {
    icon: "🚐",
    capacity: "50kg",
    description: "Larger packages",
    price: 90,
    originalPrice: 115
  },
  "Bakkie": {
    icon: "🛻",
    capacity: "100kg",
    description: "Heavy packages",
    price: 120,
    originalPrice: 150
  },

  // Towing
  "Flatbed Tow": {
    icon: "🚛",
    capacity: "Standard",
    description: "Most vehicles",
    price: 350,
    originalPrice: 450
  },
  "Standard Tow": {
    icon: "🚗",
    capacity: "Light",
    description: "Small cars",
    price: 280,
    originalPrice: 350
  },
  "Heavy Duty Tow": {
    icon: "🚛",
    capacity: "Heavy",
    description: "SUVs & Bakkies",
    price: 450,
    originalPrice: 570
  },
  "Industrial Tow": {
    icon: "🚛",
    capacity: "Industrial",
    description: "Large vehicles",
    price: 600,
    originalPrice: 750
  }
};

// Calculate dynamic ETA based on vehicle type
function calculateETA(vehicleName: string, index: number): string {
  const baseETAs: Record<string, number> = {
    "Bicycle": 15,
    "Motorbike": 5,
    "Car": 8,
    "Small Van": 12,
    "Bakkie": 15,
    "1 Ton Truck": 20,
    "3 Ton Truck": 25,
    "4 Ton Truck": 30,
    "Dropside Truck": 25,
    "Tipper Truck": 30,
    "Enclosed Truck": 20,
    "Flatbed Tow": 25,
    "Standard Tow": 20,
    "Heavy Duty Tow": 30,
    "Industrial Tow": 35
  };

  const baseTime = baseETAs[vehicleName] || 15;
  return `${baseTime + index * 3} min`;
}

// Main fleet resolver function
export async function getFleetOptions(
  serviceType: 'ride' | 'package' | 'truck' | 'towing',
  extraOption?: string
): Promise<FleetVehicle[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  let vehicleNames: string[] = [];

  // Resolve which vehicles are available based on service type and selection
  switch (serviceType) {
    case 'truck':
      vehicleNames = truckMatrix[extraOption || ""] || [];
      break;
    case 'package':
      vehicleNames = packageMatrix[extraOption || ""] || [];
      break;
    case 'towing':
      vehicleNames = towingMatrix[extraOption || ""] || [];
      break;
    case 'ride':
      // For regular rides, return empty (handled by existing carTypes)
      return [];
  }

  // If no vehicles found, return empty array
  if (vehicleNames.length === 0) {
    console.warn(`No vehicles found for ${serviceType} with option: ${extraOption}`);
    return [];
  }

  // Build fleet vehicle objects with metadata
  const fleet: FleetVehicle[] = vehicleNames.map((vehicleName, index) => {
    const metadata = vehicleMetadata[vehicleName] || {};

    // Determine category and badge
    let category: 'recommended' | 'faster' | 'cheaper' = 'recommended';
    let badge: 'RECOMMENDED' | 'FASTER' | 'CHEAPER' | undefined = undefined;

    if (index === 0) {
      category = 'recommended';
      badge = 'RECOMMENDED';
    } else if (index === 1) {
      // Second option is typically cheaper
      category = 'cheaper';
      badge = 'CHEAPER';
    } else {
      // Additional options
      category = 'faster';
    }

    return {
      id: vehicleName.toLowerCase().replace(/\s+/g, '-'),
      name: vehicleName,
      description: metadata.description || 'Available now',
      eta: calculateETA(vehicleName, index),
      price: metadata.price || 100,
      originalPrice: metadata.originalPrice,
      capacity: metadata.capacity || 'Standard',
      badge,
      icon: metadata.icon || '🚗',
      category
    };
  });

  return fleet;
}

// Helper function to get vehicle display name for confirmation
export function getVehicleDisplayInfo(vehicleId: string): { name: string; icon: string } {
  const vehicleName = Object.keys(vehicleMetadata).find(
    key => key.toLowerCase().replace(/\s+/g, '-') === vehicleId
  );

  if (vehicleName) {
    const metadata = vehicleMetadata[vehicleName];
    return {
      name: vehicleName,
      icon: metadata.icon || '🚗'
    };
  }

  return { name: 'Vehicle', icon: '🚗' };
}
