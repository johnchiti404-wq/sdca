# Service Request Implementation Summary

## Overview
Successfully extended the existing ride-hailing system to support Package Delivery, Towing Service, and Truck Service using the same ConfirmOrder page. Service requests are now stored in a new Firebase collection called `serviceRequests`.

## Changes Made

### 1. Firebase Configuration (`src/config/firebase.ts`)
**Added Firebase Auth support:**
```typescript
import { getAuth } from 'firebase/auth';
export const auth = getAuth(app);
```

### 2. SelectRide Page (`src/pages/SelectRide.tsx`)
**Modified the Select button to conditionally handle rides vs services:**
- For `serviceType === 'ride'`: Uses existing `onSelectRide` callback (unchanged)
- For other service types: Navigates to `/confirm-order` with state containing:
  - `serviceType`: "package" | "towing" | "truck"
  - `vehicle`: Selected vehicle object
  - `extraSelection`: Weight/Vehicle Type/Cargo Type
  - `pickupAddress`: Pickup location
  - `destinationAddress`: Destination location
  - `stops`: Array of stops

### 3. ConfirmOrder Page (`src/pages/ConfirmOrder.tsx`)
**Major updates to handle service requests:**

#### State Reading
```typescript
const {
  orderType = 'ride',
  orderData = {},
  serviceType,
  vehicle,
  extraSelection,
  pickupAddress,
  destinationAddress
} = location.state || {};

const isService = serviceType && serviceType !== 'ride';
```

#### Helper Functions
- `getServiceLabel()`: Returns "Package Delivery", "Towing Service", or "Truck Service"
- `getExtraSelectionLabel()`: Returns "Weight", "Vehicle Type", or "Cargo Type"
- `buildServiceRequest()`: Constructs the Firebase payload with authenticated user data
- `confirmServiceRequest()`: Writes to `serviceRequests` collection and navigates

#### Firebase Payload Structure
```typescript
{
  type: "package" | "towing" | "truck",
  vehicleClass: "1 Ton Truck" | "Flatbed Tow" | etc.,
  serviceMeta: {
    weight: "0-5kg" | vehicle_type: "sedan" | cargo_type: "furniture"
  },
  pickupAddress: string,
  destinationAddress: string,
  stops: string[],
  status: "pending",
  timestamp: number,
  userId: string (from auth.currentUser.uid),
  userName: string (from auth.currentUser.displayName),
  userEmail: string (from auth.currentUser.email),
  pricing: {
    basePrice: number,
    currency: "ZAR"
  }
}
```

#### Conditional Confirmation Logic
```typescript
const handleConfirmOrder = async () => {
  if (isService) {
    await confirmServiceRequest(); // NEW: Service request path
  } else if (isFood) {
    // Existing food order logic (unchanged)
  } else {
    // Existing ride logic (unchanged)
  }
};
```

#### Dynamic UI Display
Added new service-specific display section showing:
- Service type label (Package Delivery/Towing Service/Truck Service)
- Pickup and destination addresses
- Selected vehicle name
- Extra selection with proper label
- Total price

## User Flow

1. User selects Package/Towing/Truck from Aletwende Send
2. Enters pickup and destination in YourRoute
3. Selects weight/vehicle type/cargo type
4. Sees available vehicles in SelectRide
5. Selects a vehicle → navigates to ConfirmOrder with service state
6. Reviews service details on ConfirmOrder page
7. Clicks "Confirm order" → writes to `serviceRequests` collection
8. Navigates to WaitingForDriver page

## Authentication
- Uses `auth.currentUser` for real user data
- Throws error if user is not authenticated
- Pulls `uid`, `displayName`, and `email` from Firebase Auth
- Falls back to profile data if displayName is unavailable

## Data Storage
- Rides: `rides` collection (unchanged)
- Food Orders: `foodOrders` collection (unchanged)
- Service Requests: `serviceRequests` collection (NEW)
- localStorage keys:
  - `currentServiceRequestId`: Service request ID
  - `currentOrderType`: "service"

## Build Status
✅ Project builds successfully with no errors
✅ All existing ride and food flows remain unchanged
✅ Service request implementation complete

## Next Steps (Out of Scope)
- Driver-side listener for `serviceRequests` collection
- Status updates (pending → accepted → completed)
- Service-specific driver matching logic
