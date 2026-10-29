import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDeliveryFee,
  DEFAULT_DELIVERY_ZONES,
  FREE_DELIVERY_THRESHOLD,
  validateDeliveryZones,
} from './delivery-pricing';

test('delivery pricing starts at R45 and rounds additional road kilometres up', () => {
  assert.equal(calculateDeliveryFee(100, 8), 45);
  assert.equal(calculateDeliveryFee(100, 8.01), 50);
  assert.equal(calculateDeliveryFee(100, 9), 50);
  assert.equal(calculateDeliveryFee(100, 9.01), 55);
});

test('orders at or above R500 receive free delivery', () => {
  assert.equal(calculateDeliveryFee(FREE_DELIVERY_THRESHOLD - 0.01, 25), 130);
  assert.equal(calculateDeliveryFee(FREE_DELIVERY_THRESHOLD, 25), 0);
  assert.equal(calculateDeliveryFee(FREE_DELIVERY_THRESHOLD + 1, 25), 0);
});

test('default coverage is the editable 25 km Mthatha CBD reference area', () => {
  assert.deepEqual(validateDeliveryZones(DEFAULT_DELIVERY_ZONES), [{
    id: 'mthatha-eastern-cape',
    city: 'Mthatha',
    province: 'Eastern Cape',
    latitude: -31.5889,
    longitude: 28.7844,
    maxRoadDistanceKm: 25,
    enabled: true,
  }]);
});

test('delivery zone settings reject invalid coordinates and duplicate IDs', () => {
  assert.throws(() => validateDeliveryZones([{ ...DEFAULT_DELIVERY_ZONES[0], latitude: 91 }]), /valid latitude and longitude/);
  assert.throws(() => validateDeliveryZones([DEFAULT_DELIVERY_ZONES[0], DEFAULT_DELIVERY_ZONES[0]]), /unique ID/);
});
