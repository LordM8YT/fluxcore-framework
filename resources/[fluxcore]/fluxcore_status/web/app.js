'use strict';

const elements = Object.fromEntries(
  [
    'app', 'player-name', 'job', 'money', 'cash', 'bank', 'health', 'armor',
    'armor-item', 'hunger', 'thirst', 'stamina', 'stress', 'vehicle', 'speed',
    'speed-unit', 'gear', 'fuel', 'engine', 'engine-state', 'seatbelt', 'plate',
    'rpm', 'voice-item',
    'voice',
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

function text(id, value) {
  elements[id].textContent = value == null ? '' : String(value);
}

function money(value) {
  return `$${Math.floor(Number(value) || 0).toLocaleString('en-US')}`;
}

function render(payload = {}) {
  const player = payload.player || {};
  const status = payload.status || {};
  const visibility = payload.visibility || {};
  const job = player.job || {};

  text('player-name', player.name || 'Fluxcore');
  text(
    'job',
    [job.label || job.name, job.gradeLabel, job.onDuty ? 'On duty' : null]
      .filter(Boolean)
      .join(' · '),
  );
  text('cash', money(player.money?.cash));
  text('bank', money(player.money?.bank));
  elements.money.classList.toggle('hidden', visibility.money === false);

  for (const name of [
    'health', 'armor', 'hunger', 'thirst', 'stamina', 'stress',
  ]) {
    text(name, Math.max(0, Math.min(100, Math.round(Number(status[name]) || 0))));
  }
  elements['armor-item'].classList.toggle('hidden', Number(status.armor) <= 0);

  const voice = payload.voice || {};
  elements['voice-item'].classList.toggle('hidden', voice.ready !== true);
  elements['voice-item'].classList.toggle('talking', voice.talking === true);
  elements['voice-item'].title = voice.ready
    ? `Proximity voice · ${Math.round(Number(voice.proximityDistance) || 0)} m`
    : 'Voice unavailable';
  text('voice', voice.talking ? 'LIVE' : 'MIC');

  const vehicle = payload.vehicle;
  elements.vehicle.classList.toggle('hidden', !vehicle);
  if (vehicle) {
    text('speed', String(Math.max(0, Number(vehicle.speed) || 0)).padStart(3, '0'));
    text('speed-unit', String(vehicle.speedUnit || 'kmh').toUpperCase());
    text('gear', Number(vehicle.gear) > 0 ? vehicle.gear : 'N');
    text('fuel', `${Math.round(Number(vehicle.fuel) || 0)}%`);
    text('engine', `${Math.round(Number(vehicle.engineHealth) || 0)}%`);
    text('engine-state', vehicle.engineRunning ? 'ON' : 'OFF');
    text('seatbelt', vehicle.seatbelt ? 'ON' : 'OFF');
    text('plate', vehicle.plate || '');
    elements.rpm.style.width = `${Math.max(0, Math.min(100, Number(vehicle.rpm) || 0))}%`;
  }

  elements.app.classList.toggle('hidden', visibility.hud === false);
}

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.action === 'fluxcore:hud:bootstrap') {
    render(message.payload);
  } else if (message.action === 'fluxcore:hud:close') {
    elements.app.classList.add('hidden');
  }
});
