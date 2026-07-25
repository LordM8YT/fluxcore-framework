'use strict';

const path = require('node:path');
const { businessesError } = require('./errors');

const NAME_PATTERN = /^[a-z][a-z0-9_]{1,31}$/u;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:*]{1,63}$/u;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw businessesError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw businessesError('CONFIG_INVALID', 'businesses config must be an object');
  }
  if (!input.types || typeof input.types !== 'object' || Array.isArray(input.types)) {
    throw businessesError('CONFIG_INVALID', 'types must be an object');
  }

  const types = Object.create(null);
  for (const [typeName, definition] of Object.entries(input.types)) {
    if (!NAME_PATTERN.test(typeName)) {
      throw businessesError(
        'CONFIG_INVALID',
        `business type ${typeName} is invalid`,
      );
    }
    const label = String(definition?.label || '').trim();
    if (!label || label.length > 64) {
      throw businessesError(
        'CONFIG_INVALID',
        `business type ${typeName} label is invalid`,
      );
    }
    if (
      !definition.roles ||
      typeof definition.roles !== 'object' ||
      Array.isArray(definition.roles)
    ) {
      throw businessesError(
        'CONFIG_INVALID',
        `business type ${typeName} must define roles`,
      );
    }

    const roles = Object.create(null);
    for (const [roleName, role] of Object.entries(definition.roles)) {
      if (!NAME_PATTERN.test(roleName)) {
        throw businessesError(
          'CONFIG_INVALID',
          `role ${typeName}.${roleName} is invalid`,
        );
      }
      const roleLabel = String(role?.label || '').trim();
      if (!roleLabel || roleLabel.length > 64) {
        throw businessesError(
          'CONFIG_INVALID',
          `role ${typeName}.${roleName} label is invalid`,
        );
      }
      const permissions = Array.isArray(role.permissions)
        ? [...new Set(role.permissions.map((value) => String(value).trim()))]
        : [];
      if (
        permissions.some(
          (permission) =>
            permission !== '*' && !PERMISSION_PATTERN.test(permission),
        )
      ) {
        throw businessesError(
          'CONFIG_INVALID',
          `role ${typeName}.${roleName} contains an invalid permission`,
        );
      }
      roles[roleName] = Object.freeze({
        label: roleLabel,
        permissions: Object.freeze(permissions),
      });
    }
    if (!roles.owner || !roles.owner.permissions.includes('*')) {
      throw businessesError(
        'CONFIG_INVALID',
        `business type ${typeName} must define an owner role with * permission`,
      );
    }
    types[typeName] = Object.freeze({ label, roles: Object.freeze(roles) });
  }
  if (Object.keys(types).length === 0) {
    throw businessesError('CONFIG_INVALID', 'at least one business type is required');
  }

  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/businesses.sqlite'),
    ),
    maximumMemberships: integer(
      input.maximumMemberships ?? 10,
      1,
      100,
      'maximumMemberships',
    ),
    maximumTreasury: integer(
      input.maximumTreasury ?? 1_000_000_000,
      1,
      1_000_000_000,
      'maximumTreasury',
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
    types: Object.freeze(types),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/businesses.json');
  if (!raw) {
    throw businessesError(
      'CONFIG_MISSING',
      'config/businesses.json could not be loaded',
    );
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw businessesError(
        'CONFIG_INVALID',
        'config/businesses.json is not valid JSON',
      );
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
