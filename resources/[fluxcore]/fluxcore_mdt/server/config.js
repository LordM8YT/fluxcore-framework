'use strict';

const path = require('node:path');
const { mdtError } = require('./errors');

const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:*]{1,63}$/u;

function integer(value, minimum, maximum, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw mdtError(
      'CONFIG_INVALID',
      `${label} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}

function validateConfig(input, resourcePath = process.cwd()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw mdtError('CONFIG_INVALID', 'MDT config must be an object');
  }
  const readPermission = String(
    input.readPermission || 'police.records.read',
  ).trim();
  const writePermission = String(
    input.writePermission || 'police.records.write',
  ).trim();
  if (
    !PERMISSION_PATTERN.test(readPermission) ||
    !PERMISSION_PATTERN.test(writePermission)
  ) {
    throw mdtError('CONFIG_INVALID', 'MDT permissions are invalid');
  }
  return Object.freeze({
    databaseFile: path.resolve(
      resourcePath,
      String(input.databaseFile || 'data/mdt.sqlite'),
    ),
    readPermission,
    writePermission,
    historyLimit: integer(input.historyLimit ?? 100, 1, 500, 'historyLimit'),
    searchLimit: integer(input.searchLimit ?? 25, 1, 100, 'searchLimit'),
    requestWindowMs: integer(
      input.requestWindowMs ?? 10_000,
      1000,
      60_000,
      'requestWindowMs',
    ),
    requestLimit: integer(input.requestLimit ?? 20, 1, 100, 'requestLimit'),
  });
}

function loadConfig(runtime) {
  const raw = runtime.loadResourceFile('config/mdt.json');
  if (!raw) {
    throw mdtError('CONFIG_MISSING', 'config/mdt.json could not be loaded');
  }
  try {
    return validateConfig(JSON.parse(raw), runtime.resourcePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw mdtError('CONFIG_INVALID', 'config/mdt.json is not valid JSON');
    }
    throw error;
  }
}

module.exports = {
  loadConfig,
  validateConfig,
};
