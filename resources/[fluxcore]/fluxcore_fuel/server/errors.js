'use strict';

class FuelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FuelError';
    this.code = code;
  }
}

function fuelError(code, message) {
  return new FuelError(code, message);
}

module.exports = {
  FuelError,
  fuelError,
};
