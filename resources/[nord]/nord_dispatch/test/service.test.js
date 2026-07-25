'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateConfig } = require('../server/config');
const { DispatchDatabase } = require('../server/database');
const { DispatchService } = require('../server/service');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'varde-dispatch-'));
  const players = [
    {
      source: 7,
      characterId: 'vrd_1111111111111111',
      job: { name: 'unemployed', onDuty: false },
    },
    {
      source: 8,
      characterId: 'vrd_2222222222222222',
      job: { name: 'police', onDuty: true },
    },
  ];
  const config = validateConfig(
    {
      databaseFile: 'dispatch.sqlite',
      services: {
        police: {
          label: 'Police',
          jobNames: ['police'],
          permission: 'police.records.read',
          defaultPriority: 2,
        },
      },
    },
    directory,
  );
  const database = new DispatchDatabase(config.databaseFile);
  const emitted = [];
  const service = new DispatchService(
    database,
    config,
    {
      core: {
        getPlayerData(identifier) {
          return players.find(
            (player) =>
              player.source === Number(identifier) ||
              player.characterId === identifier,
          );
        },
        getPlayerSource(characterId) {
          return players.find((player) => player.characterId === characterId)
            ?.source;
        },
        getPlayers() {
          return players;
        },
      },
      jobs: {
        hasPermission(source) {
          return Number(source) === 8;
        },
      },
      services: {
        getRoster() {
          return { police: [{ source: 8 }] };
        },
      },
    },
    {
      emitClient(...args) {
        emitted.push(args);
      },
      log() {},
    },
  );
  return { database, emitted, service };
}

test('civilian calls reach authorized on-duty staff', () => {
  const { database, emitted, service } = fixture();
  const call = service.create(
    7,
    'police',
    'Suspicious vehicle',
    { x: 1, y: 2, z: 3 },
  );
  assert.equal(emitted.some(([source]) => source === 8), true);
  assert.equal(service.snapshot(8).calls[0].id, call.id);
  assert.deepEqual(service.snapshot(7).services, []);
  assert.deepEqual(service.snapshot(7).calls, []);
  database.close();
});

test('only matching service staff can assign and close calls', () => {
  const { database, service } = fixture();
  const call = service.create(
    7,
    'police',
    'Suspicious vehicle',
    { x: 1, y: 2, z: 3 },
  );
  assert.equal(service.assign(8, call.id).units.length, 1);
  assert.equal(service.closeCall(8, call.id).status, 'closed');
  assert.throws(() => service.assign(8, call.id), /closed/u);
  database.close();
});
