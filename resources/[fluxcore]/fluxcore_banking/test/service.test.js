'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BankingDatabase } = require('../server/database');
const { BankingService } = require('../server/service');
const { validateConfig } = require('../server/config');

function createHarness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-banking-'));
  const database = new BankingDatabase(path.join(directory, 'banking.sqlite'));
  const players = new Map([
    [
      7,
      {
        characterId: 'vrd_0123456789abcdef',
        money: { cash: 500, bank: 5000 },
      },
    ],
    [
      8,
      {
        characterId: 'vrd_fedcba9876543210',
        money: { cash: 500, bank: 5000 },
      },
    ],
  ]);
  const events = [];
  const states = [];
  const ledgers = new Map();

  function player(identifier) {
    if (typeof identifier === 'string' && identifier.startsWith('vrd_')) {
      return [...players.values()].find(
        (entry) => entry.characterId === identifier,
      );
    }
    return players.get(Number(identifier));
  }

  const core = {
    getPlayerData(identifier) {
      const value = player(identifier);
      return value ? JSON.parse(JSON.stringify(value)) : null;
    },
    getPlayerSource(characterId) {
      for (const [source, value] of players) {
        if (value.characterId === characterId) {
          return source;
        }
      }
      return 0;
    },
    getMoney(identifier, currency) {
      return { ok: true, data: player(identifier).money[currency] };
    },
    getMoneyLedger(identifier, currency, limit) {
      const entries = (ledgers.get(player(identifier).characterId) || [])
        .filter((entry) => entry.currency === currency)
        .slice(-limit)
        .reverse();
      return { ok: true, data: entries };
    },
    moveMoney(identifier, fromCurrency, toCurrency, amount, reason, reference) {
      const value = player(identifier);
      if (value.money[fromCurrency] < amount) {
        return {
          ok: false,
          error: { code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds' },
        };
      }
      value.money[fromCurrency] -= amount;
      value.money[toCurrency] += amount;
      const entries = ledgers.get(value.characterId) || [];
      entries.push({
        currency: toCurrency,
        delta: amount,
        balanceAfter: value.money[toCurrency],
        reason,
        reference,
      });
      ledgers.set(value.characterId, entries);
      return { ok: true, data: true };
    },
    transferMoney(from, to, currency, amount, reason, reference) {
      const sender = player(from);
      const recipient = player(to);
      if (sender.money[currency] < amount) {
        return {
          ok: false,
          error: { code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds' },
        };
      }
      sender.money[currency] -= amount;
      recipient.money[currency] += amount;
      for (const [value, delta] of [
        [sender, -amount],
        [recipient, amount],
      ]) {
        const entries = ledgers.get(value.characterId) || [];
        entries.push({
          currency,
          delta,
          balanceAfter: value.money[currency],
          reason,
          reference,
        });
        ledgers.set(value.characterId, entries);
      }
      return { ok: true, data: true };
    },
  };
  const runtime = {
    emitClient(source, eventName, payload) {
      events.push({ source, eventName, payload });
    },
    setPlayerState(source, key, value, replicated) {
      states.push({ source, key, value, replicated });
    },
  };
  const config = validateConfig(
    {
      databaseFile: 'banking.sqlite',
      currency: 'bank',
      cashCurrency: 'cash',
      accountPrefix: 'VRD',
      accountDigits: 10,
      historyLimit: 50,
      minimumAmount: 1,
      maximumAmount: 100000,
      requestWindowMs: 10000,
      requestLimit: 10,
      accessPoints: [
        { label: 'Test Bank', x: 10, y: 20, z: 30, radius: 3 },
      ],
    },
    directory,
  );
  const service = new BankingService(database, config, core, runtime);
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { service, database, players, events, states };
}

test('accounts publish private balances and public account identifiers', (t) => {
  const { service, events, states } = createHarness(t);
  const snapshot = service.publish(7);

  assert.match(snapshot.account.accountNumber, /^VRD\d{10}$/u);
  assert.equal(snapshot.balance, 5000);
  assert.equal(events.at(-1).eventName, 'fluxcore_banking:client:update');
  assert.equal(
    states.find((state) => state.key === 'Fluxcore:bankAccount').replicated,
    true,
  );
  assert.equal(
    states.find((state) => state.key === 'Fluxcore:bankBalance').replicated,
    false,
  );
});

test('deposit and withdrawal require server-verified bank proximity', (t) => {
  const { service, players } = createHarness(t);
  assert.throws(
    () => service.deposit(7, 100, { x: 100, y: 100, z: 30 }),
    { code: 'BANK_ACCESS_REQUIRED' },
  );

  service.deposit(7, 100, { x: 10, y: 20, z: 30 });
  assert.deepEqual(players.get(7).money, { cash: 400, bank: 5100 });
  service.withdraw(7, 50, { x: 10, y: 20, z: 30 });
  assert.deepEqual(players.get(7).money, { cash: 450, bank: 5050 });
});

test('account transfers support offline-shaped character identifiers', (t) => {
  const { service, players } = createHarness(t);
  const recipient = service.ensure(8);
  const result = service.transfer(
    7,
    recipient.accountNumber,
    750,
    'Rent',
    { x: 10, y: 20, z: 30 },
  );

  assert.equal(result.amount, 750);
  assert.equal(result.balance, 4250);
  assert.equal(players.get(8).money.bank, 5750);
  assert.throws(
    () =>
      service.transfer(
        7,
        service.ensure(7).accountNumber,
        1,
        'Self',
        { x: 10, y: 20, z: 30 },
      ),
    { code: 'ACCOUNT_SAME' },
  );
});
