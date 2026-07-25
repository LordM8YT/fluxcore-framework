'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateConfig } = require('../server/config');
const { MdtDatabase } = require('../server/database');
const { MdtService } = require('../server/service');

function fixture(permission = true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Nord-mdt-'));
  const players = [
    {
      source: 8,
      characterId: 'vrd_2222222222222222',
      profile: {
        firstName: 'Jamie',
        lastName: 'Officer',
        birthDate: '1990-01-01',
        gender: 'x',
        nationality: 'US',
      },
      job: { name: 'police', onDuty: true },
    },
  ];
  const subject = {
    characterId: 'vrd_1111111111111111',
    profile: {
      firstName: 'Alex',
      lastName: 'Smith',
      birthDate: '2000-01-01',
      gender: 'x',
      nationality: 'US',
    },
    job: { name: 'unemployed', onDuty: false },
  };
  const config = validateConfig({ databaseFile: 'mdt.sqlite' }, directory);
  const database = new MdtDatabase(config.databaseFile);
  const service = new MdtService(
    database,
    config,
    {
      core: {
        getPlayerData(source) {
          return players.find((player) => player.source === Number(source));
        },
        getPlayerSource(characterId) {
          return players.find((player) => player.characterId === characterId)
            ?.source;
        },
        getPlayers() {
          return players;
        },
        getCharacterData(characterId) {
          return characterId === subject.characterId
            ? { ok: true, data: subject }
            : { ok: false, error: { code: 'CHARACTER_NOT_FOUND' } };
        },
      },
      jobs: {
        hasPermission() {
          return permission;
        },
      },
      vehicles: {
        getVehicles() {
          return [{ id: 'veh_1111111111111111', plate: 'ABC123' }];
        },
      },
      dispatch: {
        getDispatch() {
          return { ok: true, data: { calls: [] } };
        },
      },
    },
    { log() {} },
  );
  return { database, service, subject };
}

test('authorized officer can create records and read a subject profile', () => {
  const { database, service, subject } = fixture();
  const report = service.createReport(8, {
    title: 'Traffic stop',
    narrative: 'A complete report narrative.',
    subjects: [subject.characterId],
  });
  assert.match(report.id, /^rpt_/u);
  assert.equal(service.profile(8, subject.characterId).vehicles[0].plate, 'ABC123');
  assert.equal(
    service.createWarrant(8, subject.characterId, 'Failure to appear').status,
    'active',
  );
  assert.equal(service.createBolo(8, 'vehicle', 'ABC123', 'Wanted vehicle').status, 'active');
  database.close();
});

test('MDT rejects staff without the job permission', () => {
  const { database, service } = fixture(false);
  assert.throws(() => service.dashboard(8), /permission/u);
  database.close();
});
