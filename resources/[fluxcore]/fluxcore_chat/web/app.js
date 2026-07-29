const resource = typeof GetParentResourceName === 'function'
  ? GetParentResourceName()
  : 'fluxcore_chat';
const messages = document.querySelector('#messages');
const composer = document.querySelector('#composer');
const input = document.querySelector('#input');
const suggestions = document.querySelector('#suggestions');
const commands = new Map();
const history = [];
let historyIndex = 0;
const messageLifetimeMs = 12000;
let currentSuggestion = null;

const post = (route, body = {}) => fetch(`https://${resource}/${route}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function renderSuggestions() {
  const query = input.value.trim().toLowerCase();
  const matches = [...commands.values()]
    .filter((entry) => query.startsWith('/') && entry.command.toLowerCase().startsWith(query))
    .slice(0, 6);
  currentSuggestion = matches[0]?.command || null;
  suggestions.replaceChildren(...matches.map((entry) => {
    const row = document.createElement('div');
    row.className = 'suggestion';
    const command = document.createElement('b');
    command.textContent = entry.command;
    const help = document.createElement('span');
    help.textContent = entry.help;
    row.append(command, help);
    return row;
  }));
  suggestions.classList.toggle('hidden', matches.length === 0);
}

function addMessage(message = {}) {
  const row = document.createElement('div');
  row.className = `message ${String(message.type || 'system')}`;
  const author = document.createElement('span');
  author.className = 'author';
  author.textContent = message.type === 'me'
    ? `* ${message.author}`
    : message.type === 'do'
      ? `* ${message.author}:`
      : `[${message.author || 'System'}]`;
  const text = document.createElement('span');
  text.textContent = ` ${String(message.text || '')}`;
  row.append(author, text);
  messages.append(row);
  while (messages.children.length > 30) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
  row.dataset.expiresAt = String(Date.now() + messageLifetimeMs);
  window.setTimeout(() => row.classList.add('expired'), messageLifetimeMs);
}

window.addEventListener('message', ({ data }) => {
  if (data.action === 'open') {
    messages.querySelectorAll('.expired').forEach((row) => row.classList.remove('expired'));
    composer.classList.remove('hidden');
    input.value = '';
    input.focus();
    renderSuggestions();
  } else if (data.action === 'close') {
    composer.classList.add('hidden');
    suggestions.classList.add('hidden');
    const now = Date.now();
    messages.querySelectorAll('.message').forEach((row) => {
      const expiresAt = Number(row.dataset.expiresAt || 0);
      row.classList.toggle('expired', expiresAt > 0 && expiresAt <= now);
    });
  } else if (data.action === 'message') {
    addMessage(data.message);
  } else if (data.action === 'clear') {
    messages.replaceChildren();
  } else if (data.action === 'suggestion' && data.suggestion?.command) {
    commands.set(data.suggestion.command, data.suggestion);
  } else if (data.action === 'removeSuggestion') {
    commands.delete(String(data.command || ''));
  }
});

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (value && history.at(-1) !== value) history.push(value);
  while (history.length > 25) history.shift();
  historyIndex = history.length;
  post('submit', { text: input.value });
});
input.addEventListener('input', renderSuggestions);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') post('close');
  if (event.key === 'Tab' && currentSuggestion) {
    event.preventDefault();
    input.value = `${currentSuggestion} `;
    input.setSelectionRange(input.value.length, input.value.length);
    renderSuggestions();
  }
  if (event.key === 'ArrowUp' && history.length) {
    event.preventDefault();
    historyIndex = Math.max(0, historyIndex - 1);
    input.value = history[historyIndex] || '';
    renderSuggestions();
  }
  if (event.key === 'ArrowDown' && history.length) {
    event.preventDefault();
    historyIndex = Math.min(history.length, historyIndex + 1);
    input.value = history[historyIndex] || '';
    renderSuggestions();
  }
});
