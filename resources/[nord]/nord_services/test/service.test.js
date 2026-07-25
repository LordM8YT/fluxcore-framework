'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ServicesDatabase } = require('../server/database');
const { ServicesService } = require('../server/service');
const { validateConfig } = require('../server/config');

function harness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-services-'));
  const database = new ServicesDatabase(path.join(directory, 'services.sqlite'));
  const players = new Map([
    [
      7,
      {
        characterId: 'vrd_0123456789abcdef',
        profile: { firstName: 'Mia', lastName: 'Mechanic' },
        job: { name: 'mechanic', onDuty: true },
        money: { bank: 5000 },
      },
    ],
    [
      8,
      {
        characterId: 'vrd_fedcba9876543210',
        profile: { firstName: 'Ron', lastName: 'Customer' },
        job: { name: 'unemployed', onDuty: false },
        money: { bank: 5000 },
      },
    ],
  ]);
  const events = [];
  function player(identifier) {
    if (typeof identifier === 'string' && identifier.startsWith('vrd_')) {
      return [...players.values()].find(
        (entry) => entry.characterId === identifier,
      );
    }
    return players.get(Number(identifier));
  }
  const integrations = {
    core: {
      getPlayerData(identifier) {
        return player(identifier) || null;
      },
      getPlayerSource(id) {
        for (const [source, value] of players) {
          if (value.characterId === id) {
            return source;
          }
        }
        return 0;
      },
      getPlayers() {
        return [...players.entries()].map(([source, value]) => ({
          source,
          ...value,
        }));
      },
      transferMoney(from, to, currency, amount) {
        const sender = player(from);
        const recipient = player(to);
        if (sender.money[currency] < amount) {
          return {
            ok: false,
            error: { code: 'INSUFFICIENT_FUNDS', message: 'not enough' },
          };
        }
        sender.money[currency] -= amount;
        recipient.money[currency] += amount;
        return { ok: true, data: true };
      },
      removeMoney() {
        return { ok: true, data: true };
      },
      addMoney() {
        return { ok: true, data: true };
      },
    },
    jobs: {
      hasPermission(identifier, permission) {
        return Number(identifier) === 7 && permission === 'mechanic.invoice';
      },
    },
    businesses: {
      hasPermission() {
        return true;
      },
      creditTreasury() {
        return { ok: true, data: true };
      },
    },
  };
  const runtime = {
    emitClient(source, eventName, payload) {
      events.push({ source, eventName, payload });
    },
  };
  const config = validateConfig(
    {
      databaseFile: 'services.sqlite',
      currency: 'bank',
      historyLimit: 50,
      requestWindowMs: 10000,
      requestLimit: 10,
      services: {
        mechanic: {
          label: 'Mechanic',
          jobNames: ['mechanic'],
          invoicePermission: 'mechanic.invoice',
          maximumInvoice: 10000,
        },
      },
    },
    directory,
  );
  const service = new ServicesService(
    database,
    config,
    integrations,
    runtime,
  );
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { service, database, players, events };
}

test('on-duty staff can issue and recipients can pay invoices', (t) => {
  const { service, players } = harness(t);
  const invoice = service.createInvoice(
    7,
    'mechanic',
    8,
    1250,
    'Engine repair',
  );
  assert.equal(invoice.status, 'pending');
  const paid = service.pay(8, invoice.id);
  assert.equal(paid.status, 'paid');
  assert.equal(players.get(8).money.bank, 3750);
  assert.equal(players.get(7).money.bank, 6250);
});

test('service permissions and invoice ownership are enforced', (t) => {
  const { service } = harness(t);
  assert.throws(
    () => service.createInvoice(8, 'mechanic', 7, 100, 'Invalid'),
    { code: 'FORBIDDEN' },
  );
  const invoice = service.createInvoice(7, 'mechanic', 8, 100, 'Valid');
  assert.throws(() => service.pay(7, invoice.id), { code: 'FORBIDDEN' });
});

test('roster contains only matching on-duty staff', (t) => {
  const { service } = harness(t);
  const roster = service.roster();
  assert.equal(roster.mechanic.length, 1);
  assert.equal(roster.mechanic[0].source, 7);
});
