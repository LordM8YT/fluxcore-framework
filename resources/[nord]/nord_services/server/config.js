'use strict';

const path = require('node:path');
const { servicesError } = require('./errors');

const NAME_PATTERN = /^[a-z][a-z0-9_]{1,31}$/u;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:*]{1,63}$/u;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw servicesError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw servicesError('CONFIG_INVALID', 'services config must be an object');
  }
  if (
    !input.services ||
    typeof input.services !== 'object' ||
    Array.isArray(input.services)
  ) {
    throw servicesError('CONFIG_INVALID', 'services must be an object');
  }
  const services = Object.create(null);
  for (const [name, definition] of Object.entries(input.services)) {
    if (!NAME_PATTERN.test(name)) {
      throw servicesError('CONFIG_INVALID', `service ${name} is invalid`);
    }
    const label = String(definition?.label || '').trim();
    const jobNames = Array.isArray(definition?.jobNames)
      ? [...new Set(definition.jobNames.map((job) => String(job).trim()))]
      : [];
    const invoicePermission = String(
      definition?.invoicePermission || '',
    ).trim();
    if (!label || label.length > 64) {
      throw servicesError(
        'CONFIG_INVALID',
        `service ${name} label is invalid`,
      );
    }
    if (
      jobNames.length === 0 ||
      jobNames.some((job) => !NAME_PATTERN.test(job))
    ) {
      throw servicesError(
        'CONFIG_INVALID',
        `service ${name} jobNames are invalid`,
      );
    }
    if (!PERMISSION_PATTERN.test(invoicePermission)) {
      throw servicesError(
        'CONFIG_INVALID',
        `service ${name} invoicePermission is invalid`,
      );
    }
    services[name] = Object.freeze({
      label,
      jobNames: Object.freeze(jobNames),
      invoicePermission,
      maximumInvoice: integer(
        definition.maximumInvoice ?? 100_000,
        1,
        1_000_000_000,
        `${name}.maximumInvoice`,
      ),
    });
  }
  if (Object.keys(services).length === 0) {
    throw servicesError('CONFIG_INVALID', 'at least one service is required');
  }

  const currency = String(input.currency || 'bank').trim().toLowerCase();
  if (!NAME_PATTERN.test(currency)) {
    throw servicesError('CONFIG_INVALID', 'currency is invalid');
  }

  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/services.sqlite'),
    ),
    currency,
    historyLimit: integer(
      input.historyLimit ?? 100,
      1,
      500,
      'historyLimit',
    ),
    requestWindowMs: integer(
      input.requestWindowMs ?? 10_000,
      1000,
      60_000,
      'requestWindowMs',
    ),
    requestLimit: integer(
      input.requestLimit ?? 15,
      1,
      100,
      'requestLimit',
    ),
    services: Object.freeze(services),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/services.json');
  if (!raw) {
    throw servicesError(
      'CONFIG_MISSING',
      'config/services.json could not be loaded',
    );
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw servicesError(
        'CONFIG_INVALID',
        'config/services.json is not valid JSON',
      );
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
