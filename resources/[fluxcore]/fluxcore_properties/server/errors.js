'use strict';

class PropertiesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PropertiesError';
    this.code = code;
  }
}

function propertiesError(code, message) {
  return new PropertiesError(code, message);
}

module.exports = {
  PropertiesError,
  propertiesError,
};
