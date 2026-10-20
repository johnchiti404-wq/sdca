/**
 * Returns the correct vehicle PNG asset for a driver based on their
 * vehicleCategory (from Firestore orders/drivers) and the color they
 * registered for their vehicle.
 *
 * Falls back to the black variant when no color-specific asset exists.
 */
export function getDriverVehicleIcon(vehicleCategory: string, color: string): string {
  const cat = (vehicleCategory || '').toLowerCase().trim();
  const col = (color || '').toLowerCase().trim();

  // Bicycle
  if (cat === 'bicycle') {
    if (col === 'blue') return '/cars/abicyclebl.png';
    if (col === 'red') return '/cars/abicycler.png';
    return '/cars/abicycleb.png';
  }

  // Minibus / bus
  if (cat === 'minibus' || cat === 'bus' || cat === 'xl' || cat === 'xxl') {
    if (col === 'blue') return '/cars/abusbl.png';
    if (col === 'gray' || col === 'grey') return '/cars/abusg.png';
    if (col === 'white') return '/cars/abusw.png';
    return '/cars/abusb.png';
  }

  // Aletwende car (fixed — no colour variants)
  if (cat === 'aletwende' || cat === 'ride_aletwende') {
    return '/cars/aletwende1.png';
  }

  // Car (default passenger vehicle)
  if (cat === 'car') {
    if (col === 'blue') return '/cars/acarbl.png';
    if (col === 'gray' || col === 'grey') return '/cars/acarg.png';
    if (col === 'red') return '/cars/acarr.png';
    if (col === 'white') return '/cars/acarw.png';
    return '/cars/acarb.png';
  }

  // Closed truck
  if (cat === 'closed_truck' || cat === 'closed truck' || cat === 'delivery_truck_closed') {
    if (col === 'blue') return '/cars/aclosedbl.png';
    if (col === 'gray' || col === 'grey') return '/cars/aclosedg.png';
    if (col === 'red') return '/cars/aclosedr.png';
    if (col === 'white') return '/cars/aclosedw.png';
    return '/cars/aclosedb.png';
  }

  // Open truck / flatbed
  if (cat === 'open_truck' || cat === 'open truck' || cat === 'delivery_truck_flatbed') {
    if (col === 'blue') return '/cars/aopenbl.png';
    if (col === 'gray' || col === 'grey') return '/cars/aopeng.png';
    if (col === 'red') return '/cars/aopenr.png';
    if (col === 'white') return '/cars/aopenw.png';
    return '/cars/aopenb.png';
  }

  // Refrigerated truck (and generic "truck")
  if (
    cat === 'truck' ||
    cat === 'refrigerated' ||
    cat === 'refrigerated_truck' ||
    cat === 'delivery_truck_refrigerated' ||
    cat === 'delivery_truck'
  ) {
    if (col === 'blue') return '/cars/atruckbl.png';
    if (col === 'gray' || col === 'grey') return '/cars/atruckg.png';
    if (col === 'red') return '/cars/atruckr.png';
    if (col === 'white') return '/cars/atruckw.png';
    return '/cars/atruckb.png';
  }

  // Motorbike
  if (cat === 'motorbike' || cat === 'motorcycle' || cat === 'delivery_motorbike') {
    if (col === 'blue') return '/cars/amotorbikebl.png';
    if (col === 'red') return '/cars/amotorbiker.png';
    return '/cars/amotorbikeb.png';
  }

  // Default: black car
  return '/cars/acarb.png';
}
