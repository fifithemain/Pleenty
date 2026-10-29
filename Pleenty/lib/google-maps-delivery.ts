import type { DeliveryZone } from './delivery-pricing';

type Coordinates = { latitude: number; longitude: number };
type GeocodingResponse = {
  status: string;
  results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
};
type RoutesResponse = { routes?: Array<{ distanceMeters?: number }> };

export class DeliveryAddressError extends Error {}

function getApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new DeliveryAddressError('Delivery address checks are not configured. Set GOOGLE_MAPS_API_KEY before accepting orders.');
  return key;
}

async function geocodeAddress(address: string, key: string): Promise<Coordinates> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'za');
  url.searchParams.set('key', key);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new DeliveryAddressError(`Google Geocoding API request failed (HTTP ${response.status}). Please try again.`);

  const data = await response.json() as GeocodingResponse;
  if (data.status === 'ZERO_RESULTS') {
    throw new DeliveryAddressError('We could not find that delivery address. Please include a street, suburb and city.');
  }
  const location = data.results?.[0]?.geometry?.location;
  if (data.status !== 'OK' || !location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw new DeliveryAddressError(`Google Geocoding could not verify this address (${data.status || 'invalid response'}). Please check the address and try again.`);
  }
  return { latitude: location.lat, longitude: location.lng };
}

async function getRoadDistanceMeters(origin: DeliveryZone, destination: Coordinates, key: string): Promise<number> {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      units: 'METRIC',
    }),
  });
  if (!response.ok) throw new DeliveryAddressError(`Google Routes API request failed (HTTP ${response.status}). Please try again.`);

  const data = await response.json() as RoutesResponse;
  const distanceMeters = data.routes?.[0]?.distanceMeters;
  if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new DeliveryAddressError(`Google Routes could not find a drivable route from ${origin.city}. Please check the address and try again.`);
  }
  return distanceMeters;
}

export async function getDeliveryRoadDistance(address: string, zones: DeliveryZone[]) {
  const enabledZones = zones.filter(zone => zone.enabled);
  if (!enabledZones.length) {
    throw new DeliveryAddressError('Online delivery is currently unavailable because no delivery areas are enabled.');
  }

  const key = getApiKey();
  try {
    const destination = await geocodeAddress(address, key);
    const routes = await Promise.all(enabledZones.map(async zone => ({
      zone,
      distanceKm: await getRoadDistanceMeters(zone, destination, key) / 1000,
    })));
    const eligible = routes.filter(route => route.distanceKm <= route.zone.maxRoadDistanceKm);
    if (!eligible.length) {
      throw new DeliveryAddressError('This address is outside our current delivery areas. Please use an address within an enabled delivery area.');
    }
    return eligible.reduce((nearest, route) => route.distanceKm < nearest.distanceKm ? route : nearest);
  } catch (error) {
    if (error instanceof DeliveryAddressError) throw error;
    console.error('Google Maps could not verify the delivery address:', error);
    throw new DeliveryAddressError('We could not verify the delivery address right now. Please try again shortly.');
  }
}
