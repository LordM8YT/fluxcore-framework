'use strict';

const path = require('node:path');
const { worldError } = require('./errors');

const NAME_PATTERN = /^[a-z][a-z0-9_]{1,47}$/u;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:*]{1,63}$/u;
const VEHICLE_TYPES = new Set([
  'automobile',
  'bike',
  'boat',
  'heli',
  'plane',
  'submarine',
  'trailer',
  'train',
]);

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw worldError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function finite(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw worldError(
      'CONFIG_INVALID',
      `${label} must be between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function coordinates(input, label) {
  return Object.freeze({
    x: finite(input?.x, -10_000, 10_000, `${label}.x`),
    y: finite(input?.y, -10_000, 10_000, `${label}.y`),
    z: finite(input?.z, -2_000, 2_000, `${label}.z`),
  });
}

function label(value, pathLabel) {
  const output = String(value || '').trim();
  if (!output || output.length > 80) {
    throw worldError('CONFIG_INVALID', `${pathLabel} is invalid`);
  }
  return output;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw worldError('CONFIG_INVALID', 'world config must be an object');
  }

  const shops = Object.create(null);
  for (const [id, definition] of Object.entries(input.shops || {})) {
    if (!NAME_PATTERN.test(id)) {
      throw worldError('CONFIG_INVALID', `shop ${id} is invalid`);
    }
    const items = Object.create(null);
    for (const [itemName, price] of Object.entries(definition?.items || {})) {
      if (!NAME_PATTERN.test(itemName)) {
        throw worldError('CONFIG_INVALID', `shop ${id} item is invalid`);
      }
      items[itemName] = integer(price, 0, 1_000_000_000, `${id}.${itemName}`);
    }
    if (Object.keys(items).length === 0) {
      throw worldError('CONFIG_INVALID', `shop ${id} has no items`);
    }
    shops[id] = Object.freeze({
      id,
      label: label(definition.label, `${id}.label`),
      position: coordinates(definition.position, `${id}.position`),
      items: Object.freeze(items),
    });
  }

  const dealerships = Object.create(null);
  for (const [id, definition] of Object.entries(input.dealerships || {})) {
    if (!NAME_PATTERN.test(id)) {
      throw worldError('CONFIG_INVALID', `dealership ${id} is invalid`);
    }
    const vehicles = Object.create(null);
    for (const [model, vehicle] of Object.entries(definition?.vehicles || {})) {
      const type = String(vehicle?.type || '').trim().toLowerCase();
      if (!NAME_PATTERN.test(model) || !VEHICLE_TYPES.has(type)) {
        throw worldError(
          'CONFIG_INVALID',
          `dealership ${id} vehicle ${model} is invalid`,
        );
      }
      vehicles[model] = Object.freeze({
        model,
        label: label(vehicle.label, `${id}.${model}.label`),
        price: integer(
          vehicle.price,
          0,
          1_000_000_000,
          `${id}.${model}.price`,
        ),
        type,
      });
    }
    if (Object.keys(vehicles).length === 0) {
      throw worldError('CONFIG_INVALID', `dealership ${id} has no vehicles`);
    }
    const garageId = String(definition.garageId || '').trim();
    if (!NAME_PATTERN.test(garageId)) {
      throw worldError('CONFIG_INVALID', `${id}.garageId is invalid`);
    }
    dealerships[id] = Object.freeze({
      id,
      label: label(definition.label, `${id}.label`),
      position: coordinates(definition.position, `${id}.position`),
      garageId,
      vehicles: Object.freeze(vehicles),
    });
  }

  const doors = Object.create(null);
  for (const [id, definition] of Object.entries(input.doors || {})) {
    const permission = String(definition?.permission || '').trim();
    const jobNames = Array.isArray(definition?.jobNames)
      ? [...new Set(definition.jobNames.map((job) => String(job).trim()))]
      : [];
    if (
      !NAME_PATTERN.test(id) ||
      !Number.isSafeInteger(Number(definition?.modelHash)) ||
      !PERMISSION_PATTERN.test(permission) ||
      jobNames.length === 0 ||
      jobNames.some((job) => !NAME_PATTERN.test(job))
    ) {
      throw worldError('CONFIG_INVALID', `door ${id} is invalid`);
    }
    doors[id] = Object.freeze({
      id,
      label: label(definition.label, `${id}.label`),
      modelHash: Number(definition.modelHash),
      position: coordinates(definition.position, `${id}.position`),
      defaultLocked: Boolean(definition.defaultLocked),
      jobNames: Object.freeze(jobNames),
      permission,
    });
  }

  const currency = String(input.currency || 'bank').trim().toLowerCase();
  if (!NAME_PATTERN.test(currency)) {
    throw worldError('CONFIG_INVALID', 'currency is invalid');
  }
  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/world.sqlite'),
    ),
    currency,
    interactionDistance: finite(
      input.interactionDistance ?? 4,
      1,
      20,
      'interactionDistance',
    ),
    requestWindowMs: integer(
      input.requestWindowMs ?? 10_000,
      1000,
      60_000,
      'requestWindowMs',
    ),
    requestLimit: integer(input.requestLimit ?? 25, 1, 100, 'requestLimit'),
    maximumPurchaseQuantity: integer(
      input.maximumPurchaseQuantity ?? 20,
      1,
      1000,
      'maximumPurchaseQuantity',
    ),
    shops: Object.freeze(shops),
    dealerships: Object.freeze(dealerships),
    doors: Object.freeze(doors),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/world.json');
  if (!raw) {
    throw worldError('CONFIG_MISSING', 'config/world.json could not be loaded');
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw worldError('CONFIG_INVALID', 'config/world.json is not valid JSON');
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
