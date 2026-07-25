'use strict';

const path = require('node:path');
const { propertiesError } = require('./errors');

const NAME_PATTERN = /^[a-z][a-z0-9_]{1,47}$/u;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw propertiesError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function number(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw propertiesError(
      'CONFIG_INVALID',
      `${label} must be between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function coordinates(input, label) {
  return Object.freeze({
    x: number(input?.x, -10_000, 10_000, `${label}.x`),
    y: number(input?.y, -10_000, 10_000, `${label}.y`),
    z: number(input?.z, -2_000, 2_000, `${label}.z`),
  });
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw propertiesError('CONFIG_INVALID', 'properties config must be an object');
  }
  const definitions = input.properties;
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) {
    throw propertiesError('CONFIG_INVALID', 'properties must be an object');
  }
  const properties = Object.create(null);
  for (const [id, definition] of Object.entries(definitions)) {
    const label = String(definition?.label || '').trim();
    const type = String(definition?.type || '').trim().toLowerCase();
    const garageId = definition?.garageId
      ? String(definition.garageId).trim()
      : null;
    if (
      !NAME_PATTERN.test(id) ||
      !label ||
      label.length > 80 ||
      !NAME_PATTERN.test(type) ||
      (garageId && !NAME_PATTERN.test(garageId))
    ) {
      throw propertiesError('CONFIG_INVALID', `property ${id} is invalid`);
    }
    properties[id] = Object.freeze({
      id,
      label,
      type,
      price: integer(definition.price, 0, 1_000_000_000, `${id}.price`),
      entry: coordinates(definition.entry, `${id}.entry`),
      stash: Object.freeze({
        slots: integer(definition.stash?.slots ?? 40, 1, 200, `${id}.stash.slots`),
        maxWeight: integer(
          definition.stash?.maxWeight ?? 100_000,
          1,
          10_000_000,
          `${id}.stash.maxWeight`,
        ),
      }),
      garageId,
    });
  }
  if (Object.keys(properties).length === 0) {
    throw propertiesError('CONFIG_INVALID', 'at least one property is required');
  }
  const currency = String(input.currency || 'bank').trim().toLowerCase();
  if (!NAME_PATTERN.test(currency)) {
    throw propertiesError('CONFIG_INVALID', 'currency is invalid');
  }
  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/properties.sqlite'),
    ),
    currency,
    interactionDistance: number(
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
    requestLimit: integer(input.requestLimit ?? 20, 1, 100, 'requestLimit'),
    properties: Object.freeze(properties),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/properties.json');
  if (!raw) {
    throw propertiesError(
      'CONFIG_MISSING',
      'config/properties.json could not be loaded',
    );
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw propertiesError(
        'CONFIG_INVALID',
        'config/properties.json is not valid JSON',
      );
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
