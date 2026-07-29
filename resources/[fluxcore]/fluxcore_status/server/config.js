'use strict';

const path = require('node:path');
const { statusError } = require('./errors');

const NEED_NAME_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw statusError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function validateNeed(name, input) {
  if (!NEED_NAME_PATTERN.test(name)) {
    throw statusError('CONFIG_INVALID', `need name ${name} is invalid`);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw statusError('CONFIG_INVALID', `need ${name} must be an object`);
  }
  const minimum = integer(input.minimum ?? 0, 0, 100, `${name}.minimum`);
  const maximum = integer(input.maximum ?? 100, minimum, 100, `${name}.maximum`);
  const defaultValue = integer(
    input.default,
    minimum,
    maximum,
    `${name}.default`,
  );
  return {
    default: defaultValue,
    minimum,
    maximum,
    decay: integer(input.decay ?? 0, 0, 100, `${name}.decay`),
  };
}

function validateConsumables(input, needs) {
  if (input == null) {
    return {};
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw statusError('CONFIG_INVALID', 'consumables must be an object');
  }
  const consumables = {};
  for (const [itemName, definition] of Object.entries(input)) {
    if (!NEED_NAME_PATTERN.test(itemName)) {
      throw statusError('CONFIG_INVALID', `consumable ${itemName} is invalid`);
    }
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw statusError('CONFIG_INVALID', `consumable ${itemName} must be an object`);
    }
    if (definition.status != null) {
      const status = String(definition.status).trim().toLowerCase();
      if (!needs[status]) {
        throw statusError(
          'CONFIG_INVALID',
          `consumable ${itemName} references unknown status ${status}`,
        );
      }
      consumables[itemName] = {
        status,
        amount: integer(definition.amount, 1, 100, `${itemName}.amount`),
      };
    } else {
      consumables[itemName] = {
        heal: integer(definition.heal, 1, 100, `${itemName}.heal`),
      };
    }
  }
  return consumables;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw statusError('CONFIG_INVALID', 'status config must be an object');
  }
  if (!input.needs || typeof input.needs !== 'object' || Array.isArray(input.needs)) {
    throw statusError('CONFIG_INVALID', 'status needs must be an object');
  }
  const needs = {};
  for (const [name, definition] of Object.entries(input.needs)) {
    needs[name] = validateNeed(name, definition);
  }
  for (const required of ['hunger', 'thirst', 'stress']) {
    if (!needs[required]) {
      throw statusError('CONFIG_INVALID', `required need ${required} is missing`);
    }
  }
  return {
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/status.sqlite'),
    ),
    tickIntervalMs: integer(
      input.tickIntervalMs ?? 60_000,
      5_000,
      3_600_000,
      'tickIntervalMs',
    ),
    needs,
    consumables: validateConsumables(input.consumables, needs),
  };
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/status.json');
  if (!raw) {
    throw statusError('CONFIG_MISSING', 'config/status.json could not be loaded');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw statusError('CONFIG_INVALID', 'config/status.json is not valid JSON');
  }
  return validateConfig(parsed, runtime.resourcePath);
}

module.exports = {
  loadConfig,
  validateConfig,
};
