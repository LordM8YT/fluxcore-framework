'use strict';

class BankingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BankingError';
    this.code = code;
  }
}

function bankingError(code, message) {
  return new BankingError(code, message);
}

module.exports = {
  BankingError,
  bankingError,
};
