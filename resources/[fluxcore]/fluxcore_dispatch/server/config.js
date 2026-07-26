'use strict';

const path = require('node:path');
const { dispatchError } = require('./errors');

const NAME_PATTERN = /^[a-z][a-z0-9_]{1,31}$/u;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:*]{1,63}$/u;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw dispatchError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw dispatchError('CONFIG_INVALID', 'dispatch config must be an object');
  }
  if (
    !input.services ||
    typeof input.services !== 'object' ||
    Array.isArray(input.services)
  ) {
    throw dispatchError('CONFIG_INVALID', 'services must be an object');
  }
  const services = Object.create(null);
  for (const [name, definition] of Object.entries(input.services)) {
    const label = String(definition?.label || '').trim();
    const permission = String(definition?.permission || '').trim();
    const jobNames = Array.isArray(definition?.jobNames)
      ? [...new Set(definition.jobNames.map((job) => String(job).trim()))]
      : [];
    if (!NAME_PATTERN.test(name) || !label || label.length > 64) {
      throw dispatchError('CONFIG_INVALID', `service ${name} is invalid`);
    }
    if (
      jobNames.length === 0 ||
      jobNames.some((job) => !NAME_PATTERN.test(job)) ||
      !PERMISSION_PATTERN.test(permission)
    ) {
      throw dispatchError(
        'CONFIG_INVALID',
        `service ${name} access rules are invalid`,
      );
    }
    services[name] = Object.freeze({
      label,
      jobNames: Object.freeze(jobNames),
      permission,
      defaultPriority: integer(
        definition.defaultPriority ?? 2,
        1,
        3,
        `${name}.defaultPriority`,
      ),
    });
  }
  if (Object.keys(services).length === 0) {
    throw dispatchError('CONFIG_INVALID', 'at least one service is required');
  }
  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/dispatch.sqlite'),
    ),
    historyLimit: integer(input.historyLimit ?? 100, 1, 500, 'historyLimit'),
    requestWindowMs: integer(
      input.requestWindowMs ?? 10_000,
      1000,
      60_000,
      'requestWindowMs',
    ),
    requestLimit: integer(input.requestLimit ?? 20, 1, 100, 'requestLimit'),
    minimumDescriptionLength: integer(
      input.minimumDescriptionLength ?? 4,
      1,
      64,
      'minimumDescriptionLength',
    ),
    services: Object.freeze(services),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/dispatch.json');
  if (!raw) {
    throw dispatchError(
      'CONFIG_MISSING',
      'config/dispatch.json could not be loaded',
    );
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw dispatchError(
        'CONFIG_INVALID',
        'config/dispatch.json is not valid JSON',
      );
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
