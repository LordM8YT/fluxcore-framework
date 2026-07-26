'use strict';

class BusinessesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BusinessesError';
    this.code = code;
  }
}

function businessesError(code, message) {
  return new BusinessesError(code, message);
}

module.exports = {
  BusinessesError,
  businessesError,
};
