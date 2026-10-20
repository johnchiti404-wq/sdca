const BASE_FARE = 50;
const PER_KM_RATE = 15;
const STOP_CHARGE = 10;

export function calculatePriceWithStops(pickup: string, destination: string, stops: string[]): {
  basePrice: number;
  stopCharges: number;
  totalPrice: number;
} {
  const distance = Math.random() * 10 + 5;
  const basePrice = BASE_FARE + (distance * PER_KM_RATE);
  const stopCharges = stops.length * STOP_CHARGE;
  const totalPrice = basePrice + stopCharges;

  return {
    basePrice: Math.round(basePrice),
    stopCharges,
    totalPrice: Math.round(totalPrice)
  };
}

export function getCarTypePrice(basePrice: number, carType: string): number {
  const multipliers: { [key: string]: number } = {
    'Bolt': 1.0,
    'Comfort': 1.2,
    'Bolt XL': 1.5,
    'Premium': 1.8
  };

  const multiplier = multipliers[carType] || 1.0;
  return Math.round(basePrice * multiplier);
}
