'use strict';

const progress = document.querySelector('#progress');
const percent = document.querySelector('#percent');
const status = document.querySelector('#status');
const tip = document.querySelector('#tip');
const tips = [
  'Tips: God RP handler om å gi andre noe å spille videre på.',
  'Tips: Bruk karakterens historie når du tar valg.',
  'Tips: Konflikt er best når alle får mulighet til å svare.',
  'Tips: Hold deg in-character og bruk support ved tekniske problemer.',
];
let tipIndex = 0;

setInterval(() => {
  tipIndex = (tipIndex + 1) % tips.length;
  tip.textContent = tips[tipIndex];
}, 6000);

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.eventName === 'loadProgress') {
    const value = Math.max(0, Math.min(1, Number(data.loadFraction) || 0));
    const display = Math.round(value * 100);
    progress.style.width = `${display}%`;
    percent.textContent = `${display}%`;
    status.textContent = display < 100 ? 'Laster inn byen' : 'Gjør klart karakterene';
  }
});
