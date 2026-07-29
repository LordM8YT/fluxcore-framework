'use strict';

const { fuelError } = require('./errors');

const ID_PATTERN = /^[a-z][a-z0-9_]{1,47}$/u;
const CURRENCY_PATTERN = /^[a-z][a-z0-9_]{1,23}$/u;

function finite(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw fuelError(
      'CONFIG_INVALID',
      `${label} must be between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw fuelError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw fuelError('CONFIG_INVALID', 'fuel config must be an object');
  }

  const currency = String(input.currency || 'cash').trim().toLowerCase();
  if (!CURRENCY_PATTERN.test(currency)) {
    throw fuelError('CONFIG_INVALID', 'currency is invalid');
  }

  const stations = {};
  const entries = Object.entries(input.stations || {});
  if (entries.length === 0 || entries.length > 100) {
    throw fuelError(
      'CONFIG_INVALID',
      'stations must contain between 1 and 100 entries',
    );
  }
  for (const [id, value] of entries) {
    if (!ID_PATTERN.test(id) || !value || typeof value !== 'object') {
      throw fuelError('CONFIG_INVALID', `station ${id} is invalid`);
    }
    const label = String(value.label || '').trim();
    if (!label || label.length > 64) {
      throw fuelError('CONFIG_INVALID', `station ${id} label is invalid`);
    }
    stations[id] = Object.freeze({
      id,
      label,
      x: finite(value.x, -10_000, 10_000, `station ${id} x`),
      y: finite(value.y, -10_000, 10_000, `station ${id} y`),
      z: finite(value.z, -2_000, 3_000, `station ${id} z`),
      radius: finite(value.radius ?? 12, 2, 40, `station ${id} radius`),
    });
  }

  const minimumLiters = finite(
    input.minimumLiters ?? 1,
    0.1,
    100,
    'minimumLiters',
  );
  const maximumLiters = finite(
    input.maximumLiters ?? 100,
    minimumLiters,
    500,
    'maximumLiters',
  );

  return Object.freeze({
    currency,
    pricePerLiter: integer(
      input.pricePerLiter ?? 3,
      1,
      100_000,
      'pricePerLiter',
    ),
    minimumLiters,
    maximumLiters,
    consumptionMultiplier: finite(
      input.consumptionMultiplier ?? 1,
      0,
      20,
      'consumptionMultiplier',
    ),
    requestWindowMs: integer(
      input.requestWindowMs ?? 10_000,
      1_000,
      60_000,
      'requestWindowMs',
    ),
    requestLimit: integer(
      input.requestLimit ?? 8,
      1,
      100,
      'requestLimit',
    ),
    vehicleDistance: finite(
      input.vehicleDistance ?? 4,
      2,
      8,
      'vehicleDistance',
    ),
    fuelCanPrice: integer(
      input.fuelCanPrice ?? 250,
      1,
      100_000,
      'fuelCanPrice',
    ),
    fuelCanLiters: finite(
      input.fuelCanLiters ?? 20,
      minimumLiters,
      maximumLiters,
      'fuelCanLiters',
    ),
    stations: Object.freeze(stations),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/fuel.json');
  if (!raw) {
    throw fuelError(
      'CONFIG_MISSING',
      'config/fuel.json could not be loaded',
    );
  }
  try {
    return validateConfig(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw fuelError('CONFIG_INVALID', 'config/fuel.json is not valid JSON');
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
