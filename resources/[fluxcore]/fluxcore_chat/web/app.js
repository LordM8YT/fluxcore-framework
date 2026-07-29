const resource = typeof GetParentResourceName === 'function'
  ? GetParentResourceName()
  : 'fluxcore_chat';
const messages = document.querySelector('#messages');
const composer = document.querySelector('#composer');
const input = document.querySelector('#input');
const suggestions = document.querySelector('#suggestions');
const commands = new Map();

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
}

window.addEventListener('message', ({ data }) => {
  if (data.action === 'open') {
    composer.classList.remove('hidden');
    input.value = '';
    input.focus();
    renderSuggestions();
  } else if (data.action === 'close') {
    composer.classList.add('hidden');
    suggestions.classList.add('hidden');
  } else if (data.action === 'message') {
    addMessage(data.message);
  } else if (data.action === 'clear') {
    messages.replaceChildren();
  } else if (data.action === 'suggestion' && data.suggestion?.command) {
    commands.set(data.suggestion.command, data.suggestion);
  }
});

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  post('submit', { text: input.value });
});
input.addEventListener('input', renderSuggestions);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') post('close');
});
