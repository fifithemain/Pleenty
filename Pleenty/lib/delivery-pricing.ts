export type DeliveryZone = {
  id: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  maxRoadDistanceKm: number;
  enabled: boolean;
};

export const DEFAULT_DELIVERY_ZONES: DeliveryZone[] = [{
  id: 'mthatha-eastern-cape',
  city: 'Mthatha',
  province: 'Eastern Cape',
  latitude: -31.5889,
  longitude: 28.7844,
  maxRoadDistanceKm: 25,
  enabled: true,
}];

export const FREE_DELIVERY_THRESHOLD = 500;
export const BASE_DELIVERY_DISTANCE_KM = 8;
export const BASE_DELIVERY_FEE = 45;
export const ADDITIONAL_DELIVERY_KM_FEE = 5;

export function validateDeliveryZones(value: unknown): DeliveryZone[] {
  if (!Array.isArray(value) || value.length > 50) {
    throw new Error('Delivery areas must be a list of no more than 50 zones.');
  }

  const ids = new Set<string>();
  return value.map((zone, index) => {
    if (!zone || typeof zone !== 'object') throw new Error(`Delivery area ${index + 1} is invalid.`);
    const candidate = zone as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const city = typeof candidate.city === 'string' ? candidate.city.trim() : '';
    const province = typeof candidate.province === 'string' ? candidate.province.trim() : '';
    const latitude = candidate.latitude;
    const longitude = candidate.longitude;
    const maxRoadDistanceKm = candidate.maxRoadDistanceKm;

    if (!id || id.length > 100 || ids.has(id)) throw new Error(`Delivery area ${index + 1} needs a unique ID.`);
    if (!city || city.length > 100 || !province || province.length > 100) {
      throw new Error(`Delivery area ${index + 1} needs a city and province (up to 100 characters each).`);
    }
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`Delivery area ${city} needs valid latitude and longitude coordinates.`);
    }
    if (typeof maxRoadDistanceKm !== 'number' || !Number.isFinite(maxRoadDistanceKm) ||
      maxRoadDistanceKm < 1 || maxRoadDistanceKm > 500) {
      throw new Error(`Delivery area ${city} must cover between 1 and 500 road kilometres.`);
    }
    if (typeof candidate.enabled !== 'boolean') throw new Error(`Delivery area ${city} needs an enabled or disabled status.`);

    ids.add(id);
    return { id, city, province, latitude, longitude, maxRoadDistanceKm, enabled: candidate.enabled };
  });
}

export function calculateDeliveryFee(subtotal: number, distanceKm: number): number {
  if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error('Delivery pricing requires valid subtotal and route distance values.');
  }
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  const additionalKilometres = Math.ceil(Math.max(0, distanceKm - BASE_DELIVERY_DISTANCE_KM));
  return BASE_DELIVERY_FEE + additionalKilometres * ADDITIONAL_DELIVERY_KM_FEE;
}
