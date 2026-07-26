'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BusinessesDatabase } = require('../server/database');
const { BusinessesService } = require('../server/service');
const { validateConfig } = require('../server/config');

function harness(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-businesses-'));
  const database = new BusinessesDatabase(
    path.join(directory, 'businesses.sqlite'),
  );
  const players = new Map([
    [7, { characterId: 'vrd_0123456789abcdef' }],
    [8, { characterId: 'vrd_fedcba9876543210' }],
  ]);
  const events = [];
  const states = [];
  const core = {
    getPlayerData(identifier) {
      if (typeof identifier === 'string' && identifier.startsWith('vrd_')) {
        return [...players.values()].find(
          (player) => player.characterId === identifier,
        ) || null;
      }
      return players.get(Number(identifier)) || null;
    },
    getPlayerSource(id) {
      for (const [source, player] of players) {
        if (player.characterId === id) {
          return source;
        }
      }
      return 0;
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
      databaseFile: 'businesses.sqlite',
      maximumMemberships: 5,
      maximumTreasury: 100000,
      requestWindowMs: 10000,
      requestLimit: 10,
      types: {
        mechanic: {
          label: 'Mechanic',
          roles: {
            employee: {
              label: 'Employee',
              permissions: ['business.view'],
            },
            manager: {
              label: 'Manager',
              permissions: ['business.view', 'business.members.manage'],
            },
            owner: { label: 'Owner', permissions: ['*'] },
          },
        },
      },
    },
    directory,
  );
  const service = new BusinessesService(database, config, core, runtime);
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { service, database, events, states, players };
}

test('owner creates a company and receives replicated active state', (t) => {
  const { service, events, states } = harness(t);
  const company = service.create(7, 'mechanic', 'Harmony Repairs', 'test');
  const snapshot = service.snapshot(7);

  assert.equal(snapshot.activeBusiness.id, company.id);
  assert.equal(
    snapshot.activeBusiness.membership.permissions.includes('*'),
    true,
  );
  assert.equal(events.at(-1).eventName, 'fluxcore_businesses:client:update');
  assert.equal(states.at(-1).key, 'Fluxcore:business');
});

test('business permissions protect employee management', (t) => {
  const { service, players } = harness(t);
  const company = service.create(7, 'mechanic', 'Harmony Repairs', 'test');
  service.addMember(
    7,
    company.id,
    players.get(8).characterId,
    'employee',
    'test',
  );
  assert.equal(service.hasPermission(8, company.id, 'business.view'), true);
  assert.equal(
    service.hasPermission(8, company.id, 'business.members.manage'),
    false,
  );
  assert.throws(
    () =>
      service.addMember(
        8,
        company.id,
        players.get(7).characterId,
        'manager',
      ),
    { code: 'FORBIDDEN' },
  );
});

test('trusted treasury credits and debits remain bounded', (t) => {
  const { service } = harness(t);
  const company = service.create(7, 'mechanic', 'Harmony Repairs', 'test');
  assert.equal(
    service.changeTreasury(company.id, 5000, 'credit', 'sale', 'sale:1'),
    5000,
  );
  assert.equal(
    service.changeTreasury(company.id, 1250, 'debit', 'parts', 'parts:1'),
    3750,
  );
  assert.throws(
    () => service.changeTreasury(company.id, 4000, 'debit', 'bad', 'bad:1'),
    { code: 'INSUFFICIENT_FUNDS' },
  );
});
