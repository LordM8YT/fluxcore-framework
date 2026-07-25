'use strict';

class WorldError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorldError';
    this.code = code;
  }
}

function worldError(code, message) {
  return new WorldError(code, message);
}

module.exports = {
  WorldError,
  worldError,
};
