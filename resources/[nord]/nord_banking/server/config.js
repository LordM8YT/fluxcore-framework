'use strict';

const path = require('node:path');
const { bankingError } = require('./errors');

const CURRENCY_PATTERN = /^[a-z][a-z0-9_]{1,23}$/u;
const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,7}$/u;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw bankingError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function finite(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw bankingError(
      'CONFIG_INVALID',
      `${label} must be between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function currency(value, label) {
  const result = String(value || '').trim().toLowerCase();
  if (!CURRENCY_PATTERN.test(result)) {
    throw bankingError('CONFIG_INVALID', `${label} is invalid`);
  }
  return result;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw bankingError('CONFIG_INVALID', 'banking config must be an object');
  }

  const accountPrefix = String(input.accountPrefix || 'VRD')
    .trim()
    .toUpperCase();
  if (!PREFIX_PATTERN.test(accountPrefix)) {
    throw bankingError('CONFIG_INVALID', 'accountPrefix is invalid');
  }

  const accessPoints = Array.isArray(input.accessPoints)
    ? input.accessPoints.map((point, index) => {
        if (!point || typeof point !== 'object' || Array.isArray(point)) {
          throw bankingError(
            'CONFIG_INVALID',
            `access point ${index} is invalid`,
          );
        }
        const label = String(point.label || '').trim();
        if (!label || label.length > 64) {
          throw bankingError(
            'CONFIG_INVALID',
            `access point ${index} label is invalid`,
          );
        }
        return {
          label,
          x: finite(point.x, -10000, 10000, `access point ${index} x`),
          y: finite(point.y, -10000, 10000, `access point ${index} y`),
          z: finite(point.z, -2000, 3000, `access point ${index} z`),
          radius: finite(
            point.radius ?? 4,
            1,
            25,
            `access point ${index} radius`,
          ),
        };
      })
    : [];
  if (accessPoints.length === 0 || accessPoints.length > 100) {
    throw bankingError(
      'CONFIG_INVALID',
      'accessPoints must contain between 1 and 100 entries',
    );
  }

  const minimumAmount = integer(
    input.minimumAmount ?? 1,
    1,
    1_000_000_000,
    'minimumAmount',
  );
  const maximumAmount = integer(
    input.maximumAmount ?? 100_000_000,
    minimumAmount,
    1_000_000_000,
    'maximumAmount',
  );

  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/banking.sqlite'),
    ),
    currency: currency(input.currency || 'bank', 'currency'),
    cashCurrency: currency(input.cashCurrency || 'cash', 'cashCurrency'),
    accountPrefix,
    accountDigits: integer(
      input.accountDigits ?? 10,
      6,
      12,
      'accountDigits',
    ),
    historyLimit: integer(
      input.historyLimit ?? 50,
      1,
      200,
      'historyLimit',
    ),
    minimumAmount,
    maximumAmount,
    requestWindowMs: integer(
      input.requestWindowMs ?? 10_000,
      1_000,
      60_000,
      'requestWindowMs',
    ),
    requestLimit: integer(
      input.requestLimit ?? 12,
      1,
      100,
      'requestLimit',
    ),
    accessPoints: Object.freeze(accessPoints),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/banking.json');
  if (!raw) {
    throw bankingError(
      'CONFIG_MISSING',
      'config/banking.json could not be loaded',
    );
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw bankingError(
        'CONFIG_INVALID',
        'config/banking.json is not valid JSON',
      );
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
