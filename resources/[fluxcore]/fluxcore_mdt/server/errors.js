'use strict';

class MdtError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MdtError';
    this.code = code;
  }
}

function mdtError(code, message) {
  return new MdtError(code, message);
}

module.exports = {
  MdtError,
  mdtError,
};
