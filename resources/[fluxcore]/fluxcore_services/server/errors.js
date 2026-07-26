'use strict';

class ServicesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ServicesError';
    this.code = code;
  }
}

function servicesError(code, message) {
  return new ServicesError(code, message);
}

module.exports = {
  ServicesError,
  servicesError,
};
