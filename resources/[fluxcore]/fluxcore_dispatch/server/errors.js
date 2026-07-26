'use strict';

class DispatchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DispatchError';
    this.code = code;
  }
}

function dispatchError(code, message) {
  return new DispatchError(code, message);
}

module.exports = {
  DispatchError,
  dispatchError,
};
