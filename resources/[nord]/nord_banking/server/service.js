'use strict';

const crypto = require('node:crypto');
const { bankingError } = require('./errors');

const CHARACTER_ID_PATTERN = /^vrd_[a-f0-9]{16}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unwrap(response, fallback) {
  if (!response || response.ok !== true) {
    throw bankingError(
      response?.error?.code || 'CORE_ERROR',
      response?.error?.message || fallback,
    );
  }
  return response.data;
}

function cleanMemo(value) {
  const memo = String(value || 'transfer').trim().replace(/\s+/gu, ' ');
  if (!memo || memo.length > 96) {
    throw bankingError(
      'VALIDATION_ERROR',
      'memo must contain between 1 and 96 characters',
    );
  }
  return memo;
}

class BankingService {
  constructor(database, config, core, runtime) {
    this.database = database;
    this.config = config;
    this.core = core;
    this.runtime = runtime;
  }

  amount(value) {
    const amount = Number(value);
    if (
      !Number.isSafeInteger(amount) ||
      amount < this.config.minimumAmount ||
      amount > this.config.maximumAmount
    ) {
      throw bankingError(
        'VALIDATION_ERROR',
        `amount must be an integer from ${this.config.minimumAmount} to ${this.config.maximumAmount}`,
      );
    }
    return amount;
  }

  normalizeAccountNumber(value) {
    const accountNumber = String(value || '')
      .replace(/[\s-]+/gu, '')
      .toUpperCase();
    const pattern = new RegExp(
      `^${this.config.accountPrefix}[0-9]{${this.config.accountDigits}}$`,
      'u',
    );
    if (!pattern.test(accountNumber)) {
      throw bankingError(
        'ACCOUNT_INVALID',
        'bank account number is invalid',
      );
    }
    return accountNumber;
  }

  resolveOnline(identifier) {
    const player = this.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw bankingError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw bankingError('PLAYER_NOT_FOUND', 'online player source was not found');
    }
    return { source, characterId: player.characterId };
  }

  requireAccess(coordinates) {
    const x = Number(coordinates?.x);
    const y = Number(coordinates?.y);
    const z = Number(coordinates?.z);
    if (![x, y, z].every(Number.isFinite)) {
      throw bankingError(
        'POSITION_UNAVAILABLE',
        'player position is unavailable',
      );
    }
    const nearby = this.config.accessPoints.some(
      (point) =>
        Math.hypot(x - point.x, y - point.y, z - point.z) <=
        point.radius + 1.5,
    );
    if (!nearby) {
      throw bankingError(
        'BANK_ACCESS_REQUIRED',
        'move closer to a configured bank or ATM',
      );
    }
  }

  ensure(identifier) {
    if (
      typeof identifier === 'string' &&
      CHARACTER_ID_PATTERN.test(identifier)
    ) {
      const existing = this.database.getByCharacter(identifier);
      if (existing) {
        return existing;
      }
    }
    const online = this.resolveOnline(identifier);
    return this.database.ensure(
      online.characterId,
      this.config.accountPrefix,
      this.config.accountDigits,
    );
  }

  profileByAccount(accountNumber) {
    const profile = this.database.getByAccount(
      this.normalizeAccountNumber(accountNumber),
    );
    if (!profile) {
      throw bankingError('ACCOUNT_NOT_FOUND', 'bank account was not found');
    }
    return profile;
  }

  balance(identifier) {
    return unwrap(
      this.core.getMoney(identifier, this.config.currency),
      'core could not read the bank balance',
    );
  }

  snapshot(identifier) {
    const online = this.resolveOnline(identifier);
    const profile = this.ensure(online.source);
    const transactions = unwrap(
      this.core.getMoneyLedger(
        online.characterId,
        this.config.currency,
        this.config.historyLimit,
      ),
      'core could not read bank transactions',
    );
    return {
      contract: 'Nord.banking.bootstrap.v1',
      account: clone(profile),
      balance: this.balance(online.characterId),
      currency: this.config.currency,
      transactions: clone(transactions),
    };
  }

  publish(identifier) {
    const online = this.resolveOnline(identifier);
    const snapshot = this.snapshot(online.source);
    this.runtime.setPlayerState(
      online.source,
      'Nord:bankAccount',
      snapshot.account.accountNumber,
      true,
    );
    this.runtime.setPlayerState(
      online.source,
      'Nord:bankBalance',
      snapshot.balance,
      false,
    );
    this.runtime.emitClient(
      online.source,
      'nord_banking:client:update',
      clone(snapshot),
    );
    return snapshot;
  }

  syncIfOnline(characterId) {
    const source = Number(this.core.getPlayerSource(characterId));
    if (source > 0 && this.core.getPlayerData(source)) {
      return this.publish(source);
    }
    return null;
  }

  deposit(identifier, value, coordinates = null, trusted = false) {
    const online = this.resolveOnline(identifier);
    if (!trusted) {
      this.requireAccess(coordinates);
    }
    const amount = this.amount(value);
    unwrap(
      this.core.moveMoney(
        online.source,
        this.config.cashCurrency,
        this.config.currency,
        amount,
        'bank_deposit',
        `bank:${crypto.randomUUID()}`,
      ),
      'core rejected the cash deposit',
    );
    return this.publish(online.source);
  }

  withdraw(identifier, value, coordinates = null, trusted = false) {
    const online = this.resolveOnline(identifier);
    if (!trusted) {
      this.requireAccess(coordinates);
    }
    const amount = this.amount(value);
    unwrap(
      this.core.moveMoney(
        online.source,
        this.config.currency,
        this.config.cashCurrency,
        amount,
        'bank_withdrawal',
        `bank:${crypto.randomUUID()}`,
      ),
      'core rejected the bank withdrawal',
    );
    return this.publish(online.source);
  }

  transfer(
    identifier,
    accountNumber,
    value,
    memo,
    coordinates = null,
    trusted = false,
  ) {
    const online = this.resolveOnline(identifier);
    if (!trusted) {
      this.requireAccess(coordinates);
    }
    const sender = this.ensure(online.source);
    const recipient = this.profileByAccount(accountNumber);
    if (recipient.characterId === online.characterId) {
      throw bankingError(
        'ACCOUNT_SAME',
        'money cannot be transferred to the same account',
      );
    }
    const amount = this.amount(value);
    const reference = `bank:${crypto.randomUUID()}`;
    unwrap(
      this.core.transferMoney(
        online.source,
        recipient.characterId,
        this.config.currency,
        amount,
        cleanMemo(memo),
        reference,
      ),
      'core rejected the bank transfer',
    );
    const snapshot = this.publish(online.source);
    this.syncIfOnline(recipient.characterId);
    return {
      account: sender.accountNumber,
      recipientAccount: recipient.accountNumber,
      amount,
      reference,
      balance: snapshot.balance,
    };
  }

  deleteCharacter(characterId) {
    return CHARACTER_ID_PATTERN.test(String(characterId))
      ? this.database.deleteCharacter(String(characterId))
      : false;
  }
}

module.exports = {
  BankingService,
  cleanMemo,
};
