'use strict';

const elements = Object.fromEntries([
  'app', 'home-view', 'native-app-view', 'custom-app-view', 'app-grid',
  'conversation-list', 'contact-list', 'message-list', 'messages-empty',
  'contacts-empty', 'messages-view', 'thread-view', 'contacts-view',
  'settings-view', 'clock-view', 'notes-view', 'calculator-view', 'phone-view',
  'header-title', 'header-kicker', 'back-button', 'toast',
  'contact-dialog', 'unread-badge', 'home-unread', 'widget-badge',
  'widget-title', 'widget-copy', 'profile-number', 'profile-avatar',
  'installed-count', 'custom-app-frame', 'custom-app-title', 'message-search',
  'clock-large', 'clock-seconds', 'clock-date', 'clock-local', 'clock-utc',
  'quick-note', 'note-status', 'calculator-display', 'calculator-keys',
  'message-dialog', 'stopwatch-display', 'stopwatch-toggle', 'stopwatch-reset',
  'dialer-number', 'dialer-keys', 'dialer-panel', 'call-panel', 'call-status',
  'call-name', 'call-number', 'call-avatar', 'accept-call',
  'cipher-view', 'cipher-alias', 'cipher-channels', 'cipher-message-list',
  'cipher-input', 'cipher-voice',
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.querySelector(`#${id}`)]));

const state = {
  account: null,
  contacts: [],
  conversations: [],
  unread: 0,
  view: 'home',
  activeThread: null,
  messageMode: 'messages',
  activeCustomApp: null,
  messages: [],
  apps: [],
  busy: false,
  locale: {},
  localeName: 'en',
  calculator: { display: '0', stored: null, operator: null, reset: false },
  stopwatch: { startedAt: null, elapsed: 0, timer: null },
  dialer: '',
  call: null,
  cipher: { alias: '', channels: [], activeChannel: null, messages: [], voiceChannel: null },
};

function translation(key) {
  let current = state.locale;
  for (const part of String(key).split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function t(key, replacements = {}, fallback = key) {
  return String(translation(key) || fallback).replace(
    /\{\{([A-Za-z0-9_]+)\}\}/g,
    (match, name) => replacements[name] === undefined ? match : String(replacements[name]),
  );
}

function applyStaticLocale() {
  document.documentElement.lang = state.localeName;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n, {}, element.textContent.trim());
  });
  for (const [source, target] of [
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-placeholder', 'placeholder'],
  ]) {
    document.querySelectorAll(`[${source}]`).forEach((element) => {
      element.setAttribute(target, t(element.getAttribute(source), {}, element.getAttribute(target) || ''));
    });
  }
}

function resourceName() {
  return typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'fluxcore_phone';
}

async function nui(endpoint, payload = {}) {
  const response = await fetch(`https://${resourceName()}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

async function request(method, payload = {}) {
  const response = await nui('phoneRequest', { method, payload });
  if (!response.ok) throw new Error(response.error?.message || t('errors.requestFailed', {}, 'Phone request failed.'));
  return response.data;
}

function showToast(value, isError = false) {
  elements.toast.textContent = String(value);
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.classList.remove('is-hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.add('is-hidden'), 3200);
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.valueOf()) / 1000));
  if (seconds < 60) return t('ui.now', {}, 'now');
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return date.toLocaleDateString(state.localeName, { month: 'short', day: 'numeric' });
}

function messageTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString(state.localeName, { hour: '2-digit', minute: '2-digit' });
}

function hydrate(payload = {}) {
  state.account = payload.account || null;
  state.contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
  state.conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
  state.unread = Number(payload.unread) || 0;
}

function makeAvatar(name) {
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = initials(name);
  return avatar;
}

function renderConversations() {
  const query = elements.messageSearch.value.trim().toLocaleLowerCase(state.localeName);
  const conversations = state.conversations.filter((entry) => !query || `${entry.name || ''} ${entry.phoneNumber || ''} ${entry.lastMessage?.body || ''}`.toLocaleLowerCase(state.localeName).includes(query));
  elements.conversationList.replaceChildren(...conversations.map((conversation) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conversation';
    button.dataset.number = conversation.phoneNumber;
    const copy = document.createElement('span');
    copy.className = 'row-copy';
    const name = document.createElement('strong');
    name.textContent = conversation.name || conversation.phoneNumber;
    const preview = document.createElement('small');
    preview.textContent = conversation.lastMessage?.body || t('ui.noMessagePreview', {}, 'No messages');
    copy.append(name, preview);
    const meta = document.createElement('span');
    meta.className = 'row-meta';
    const time = document.createElement('span');
    time.textContent = relativeTime(conversation.lastMessage?.sentAt);
    meta.append(time);
    if (conversation.unread > 0) {
      const unread = document.createElement('span');
      unread.className = 'unread-dot';
      unread.textContent = String(conversation.unread);
      meta.append(unread);
    }
    button.append(makeAvatar(conversation.name), copy, meta);
    return button;
  }));
  elements.messagesEmpty.classList.toggle('is-hidden', conversations.length > 0);
}

function renderContacts() {
  elements.contactList.replaceChildren(...state.contacts.map((contact) => {
    const row = document.createElement('div');
    row.className = 'contact';
    const copy = document.createElement('span');
    copy.className = 'row-copy';
    const name = document.createElement('strong');
    name.textContent = contact.name;
    const number = document.createElement('small');
    number.textContent = contact.phoneNumber;
    copy.append(name, number);
    const actions = document.createElement('span');
    actions.className = 'contact-actions';
    const chat = document.createElement('button');
    chat.type = 'button'; chat.className = 'mini-button'; chat.dataset.messageNumber = contact.phoneNumber;
    chat.textContent = t('ui.text', {}, 'Text');
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'mini-button is-danger'; remove.dataset.deleteContact = String(contact.id);
    remove.textContent = t('ui.delete', {}, 'Delete');
    actions.append(chat, remove);
    row.append(makeAvatar(contact.name), copy, actions);
    return row;
  }));
  elements.contactsEmpty.classList.toggle('is-hidden', state.contacts.length > 0);
}

function renderMessages() {
  elements.messageList.replaceChildren(...state.messages.map((message) => {
    const bubble = document.createElement('article');
    bubble.className = 'bubble';
    bubble.classList.toggle('is-outgoing', message.direction === 'outgoing');
    const body = document.createElement('span');
    body.textContent = message.body;
    const time = document.createElement('time');
    time.dateTime = message.sentAt;
    time.textContent = `${messageTime(message.sentAt)}${message.direction === 'outgoing' && message.readAt ? ` · ${t('ui.read', {}, 'read')}` : ''}`;
    bubble.append(body, time);
    return bubble;
  }));
  elements.messageList.scrollTop = elements.messageList.scrollHeight;
}

function makeAppIcon(appDefinition) {
  const icon = document.createElement('span');
  icon.className = 'app-icon';
  icon.style.setProperty('--app-color', appDefinition.color || '#26352e');
  if (appDefinition.icon) {
    const image = document.createElement('img');
    image.src = appDefinition.icon;
    image.alt = '';
    icon.append(image);
  } else {
    icon.textContent = initials(appDefinition.name).slice(0, 1);
  }
  return icon;
}

function renderApps() {
  elements.appGrid.querySelectorAll('[data-custom-app]').forEach((element) => element.remove());
  for (const appDefinition of state.apps) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-tile';
    button.dataset.customApp = appDefinition.identifier;
    const label = document.createElement('span');
    label.textContent = appDefinition.name;
    button.append(makeAppIcon(appDefinition), label);
    elements.appGrid.append(button);
  }
  elements.installedCount.textContent = `${state.apps.length + 8} apps`;
}

function renderHome() {
  const unread = Math.max(0, state.unread);
  for (const badge of [elements.homeUnread, elements.widgetBadge]) {
    badge.textContent = String(unread);
    badge.classList.toggle('is-hidden', unread <= 0);
  }
  elements.widgetTitle.textContent = unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : "You're all caught up";
  elements.widgetCopy.textContent = unread > 0 ? 'Tap to view your conversations' : 'No unread conversations';
  elements.profileNumber.textContent = state.account?.phoneNumber || '—';
  elements.profileAvatar.textContent = initials(state.account?.name || 'Fluxcore');
  renderApps();
}

function setScreen(screen) {
  elements.homeView.classList.toggle('is-hidden', screen !== 'home');
  elements.nativeAppView.classList.toggle('is-hidden', screen !== 'native');
  elements.customAppView.classList.toggle('is-hidden', screen !== 'custom');
}

function renderNative() {
  const inThread = state.view === 'thread';
  const inMessages = state.view === 'messages';
  const isCipher = state.view === 'darkchat' || (inThread && state.messageMode === 'darkchat');
  elements.nativeAppView.classList.toggle('is-cipher', isCipher);
  elements.messagesView.classList.toggle('is-hidden', !inMessages);
  elements.contactsView.classList.toggle('is-hidden', state.view !== 'contacts');
  elements.threadView.classList.toggle('is-hidden', !inThread);
  elements.settingsView.classList.toggle('is-hidden', state.view !== 'settings');
  elements.clockView.classList.toggle('is-hidden', state.view !== 'clock');
  elements.notesView.classList.toggle('is-hidden', state.view !== 'notes');
  elements.calculatorView.classList.toggle('is-hidden', state.view !== 'calculator');
  elements.phoneView.classList.toggle('is-hidden', state.view !== 'phone');
  elements.cipherView.classList.toggle('is-hidden', state.view !== 'darkchat');
  if (inThread) {
    elements.headerKicker.textContent = state.activeThread?.phoneNumber || t('ui.conversation', {}, 'Conversation');
    elements.headerTitle.textContent = state.activeThread?.name || state.activeThread?.phoneNumber || t('ui.messages', {}, 'Messages');
  } else {
    elements.headerKicker.textContent = state.account?.phoneNumber || 'Fluxcore';
    const titles = { phone: 'Phone', contacts: t('ui.contacts', {}, 'Contacts'), settings: 'Settings', clock: 'Clock', notes: 'Notes', calculator: 'Calculator', darkchat: 'CIPHER' };
    elements.headerTitle.textContent = titles[state.view] || t('ui.messages', {}, 'Messages');
    elements.headerKicker.textContent = state.view === 'darkchat' ? 'ENCRYPTED // IN-GAME' : (state.account?.phoneNumber || 'Fluxcore');
  }
}

function render() {
  renderHome(); renderNative(); renderConversations(); renderContacts(); renderMessages(); renderDialer(); renderCall(); renderCipher();
}

async function refresh() {
  hydrate(await request('bootstrap'));
  render();
}

async function openThread(phoneNumber) {
  try {
    const result = await request('messages:list', { phoneNumber });
    state.activeThread = { phoneNumber: result.phoneNumber, name: result.name };
    state.messages = result.messages || [];
    state.view = 'thread';
    const conversation = state.conversations.find((entry) => entry.phoneNumber === phoneNumber);
    if (conversation) { state.unread = Math.max(0, state.unread - conversation.unread); conversation.unread = 0; }
    setScreen('native'); render();
  } catch (error) { showToast(error.message, true); }
}

function openNative(view) {
  if (view === 'messages' || view === 'darkchat') state.messageMode = view;
  state.view = view;
  state.activeThread = null;
  state.messages = [];
  setScreen('native');
  render();
}

function renderCipher() {
  const cipher = state.cipher;
  elements.cipherAlias.textContent = cipher.alias || 'ghost-------';
  elements.cipherChannels.replaceChildren(...cipher.channels.map((channel) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.cipherChannel = channel.id;
    button.textContent = `# ${channel.name}`; button.classList.toggle('is-active', channel.id === cipher.activeChannel); return button;
  }));
  elements.cipherMessageList.replaceChildren(...cipher.messages.map((message) => {
    const article = document.createElement('article'); article.className = 'cipher-message';
    const header = document.createElement('header'); const alias = document.createElement('span'); alias.textContent = message.alias;
    const time = document.createElement('time'); time.textContent = messageTime(message.sentAt); header.append(alias, time);
    const body = document.createElement('p'); body.textContent = message.body; article.append(header, body); return article;
  }));
  elements.cipherMessageList.scrollTop = elements.cipherMessageList.scrollHeight;
  elements.cipherInput.placeholder = `Message #${cipher.activeChannel || 'lobby'}`;
  const connected = cipher.voiceChannel === cipher.activeChannel;
  elements.cipherVoice.textContent = connected ? 'Leave VC' : 'Join VC'; elements.cipherVoice.classList.toggle('is-connected', connected);
}

async function openCipher() {
  try {
    const result = new URLSearchParams(location.search).has('preview') ? {
      profile: { alias: 'ghost-a3f91c' }, channels: [{ id: 'lobby', name: 'Lobby' }, { id: 'market', name: 'Black Market' }, { id: 'ops', name: 'Operations' }], activeChannel: 'lobby',
      messages: [{ id: 1, channel: 'lobby', alias: 'ghost-7b110e', body: 'Drop location changed. Check #ops.', sentAt: new Date().toISOString() }],
    } : await request('cipher:bootstrap');
    state.cipher = { alias: result.profile.alias, channels: result.channels || [], activeChannel: result.activeChannel, messages: result.messages || [], voiceChannel: state.cipher.voiceChannel };
    openNative('darkchat'); renderCipher();
  } catch (error) { showToast(error.message, true); }
}

async function closeCustomApp() {
  if (!state.activeCustomApp) return;
  state.activeCustomApp = null;
  elements.customAppFrame.removeAttribute('src');
  await nui('closeApp').catch(() => {});
}

async function goHome() {
  await closeCustomApp();
  state.view = 'home';
  state.activeThread = null;
  state.messages = [];
  setScreen('home');
  render();
}

async function openCustomApp(identifier) {
  const appDefinition = state.apps.find((entry) => entry.identifier === identifier);
  if (!appDefinition) return;
  const response = await nui('openApp', { identifier });
  if (!response.ok) { showToast(response.error || 'App could not be opened.', true); return; }
  state.activeCustomApp = identifier;
  elements.customAppTitle.textContent = appDefinition.name;
  elements.customAppFrame.src = `https://cfx-nui-${encodeURIComponent(appDefinition.resource)}/${appDefinition.ui.split('/').map(encodeURIComponent).join('/')}`;
  setScreen('custom');
}

elements.customAppFrame.addEventListener('load', () => {
  if (!state.activeCustomApp) return;
  elements.customAppFrame.contentWindow?.postMessage({
    type: 'fluxcore:phone:open',
    app: state.activeCustomApp,
    resourceName: state.apps.find((entry) => entry.identifier === state.activeCustomApp)?.resource,
    phoneNumber: state.account?.phoneNumber || null,
    localeName: state.localeName,
  }, '*');
});

elements.conversationList.addEventListener('click', (event) => {
  const row = event.target.closest('[data-number]');
  if (row) void openThread(row.dataset.number);
});
elements.messageSearch.addEventListener('input', renderConversations);

elements.contactList.addEventListener('click', async (event) => {
  const messageButton = event.target.closest('[data-message-number]');
  if (messageButton) { void openThread(messageButton.dataset.messageNumber); return; }
  const deleteButton = event.target.closest('[data-delete-contact]');
  if (!deleteButton || state.busy) return;
  state.busy = true;
  try {
    await request('contacts:delete', { id: Number(deleteButton.dataset.deleteContact) });
    await refresh(); showToast(t('ui.contactDeleted', {}, 'Contact deleted.'));
  } catch (error) { showToast(error.message, true); } finally { state.busy = false; }
});

document.querySelectorAll('[data-open-native]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.openNative === 'darkchat') void openCipher(); else openNative(button.dataset.openNative);
}));
elements.appGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-custom-app]');
  if (button) void openCustomApp(button.dataset.customApp);
});
document.querySelector('#message-widget').addEventListener('click', () => openNative('messages'));
document.querySelector('#dynamic-island').addEventListener('click', () => void goHome());
document.querySelector('#gesture-home').addEventListener('click', () => void goHome());
document.querySelector('#app-home-button').addEventListener('click', () => void goHome());
document.querySelector('#custom-app-back').addEventListener('click', () => void goHome());

elements.backButton.addEventListener('click', async () => {
  if (state.view === 'thread') {
    state.view = state.messageMode; state.activeThread = null; state.messages = [];
    await refresh().catch((error) => showToast(error.message, true));
    setScreen('native'); render();
  } else {
    void goHome();
  }
});

document.querySelector('#message-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy || !state.activeThread) return;
  const input = document.querySelector('#message-input');
  const body = input.value.trim();
  if (!body) return;
  state.busy = true;
  try {
    const clientNonce = globalThis.crypto?.randomUUID?.() || `browser:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    state.messages.push(await request('messages:send', { phoneNumber: state.activeThread.phoneNumber, body, clientNonce }));
    input.value = ''; renderMessages();
  } catch (error) { showToast(error.message, true); } finally { state.busy = false; }
});

document.querySelector('#add-contact-button').addEventListener('click', () => elements.contactDialog.showModal());
document.querySelector('#contact-cancel').addEventListener('click', () => elements.contactDialog.close());
document.querySelector('#contact-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  const data = new FormData(event.currentTarget);
  try {
    await request('contacts:create', { name: data.get('name'), phoneNumber: data.get('phoneNumber') });
    elements.contactDialog.close(); event.currentTarget.reset(); await refresh();
    state.view = 'contacts'; setScreen('native'); render(); showToast(t('ui.contactSaved', {}, 'Contact saved.'));
  } catch (error) { showToast(error.message, true); } finally { state.busy = false; }
});

document.querySelector('#new-message-button').addEventListener('click', () => elements.messageDialog.showModal());
document.querySelector('#message-cancel').addEventListener('click', () => elements.messageDialog.close());
document.querySelector('#new-message-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const phoneNumber = String(new FormData(event.currentTarget).get('phoneNumber') || '').trim();
  if (!phoneNumber) return;
  elements.messageDialog.close(); event.currentTarget.reset();
  void openThread(phoneNumber);
});

const accentStorageKey = 'fluxcore_phone:accent';
function setAccent(accent) {
  const safeAccent = ['lime', 'blue', 'violet', 'orange'].includes(accent) ? accent : 'lime';
  document.documentElement.dataset.accent = safeAccent;
  document.querySelectorAll('[data-accent]').forEach((button) => button.classList.toggle('is-selected', button.dataset.accent === safeAccent));
  try { localStorage.setItem(accentStorageKey, safeAccent); } catch (_) {}
}
try { setAccent(localStorage.getItem(accentStorageKey) || 'lime'); } catch (_) { setAccent('lime'); }
document.querySelector('.appearance-picker').addEventListener('click', (event) => {
  const button = event.target.closest('[data-accent]');
  if (button) setAccent(button.dataset.accent);
});

function renderStopwatch() {
  const watch = state.stopwatch;
  const elapsed = watch.elapsed + (watch.startedAt === null ? 0 : Date.now() - watch.startedAt);
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor(elapsed / 1000) % 60;
  const tenths = Math.floor(elapsed / 100) % 10;
  elements.stopwatchDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
elements.stopwatchToggle.addEventListener('click', () => {
  const watch = state.stopwatch;
  if (watch.startedAt === null) {
    watch.startedAt = Date.now();
    watch.timer = setInterval(renderStopwatch, 100);
    elements.stopwatchToggle.textContent = 'Stop';
  } else {
    watch.elapsed += Date.now() - watch.startedAt; watch.startedAt = null;
    clearInterval(watch.timer); watch.timer = null;
    elements.stopwatchToggle.textContent = 'Start'; renderStopwatch();
  }
});
elements.stopwatchReset.addEventListener('click', () => {
  const watch = state.stopwatch;
  watch.elapsed = 0;
  if (watch.startedAt !== null) watch.startedAt = Date.now();
  renderStopwatch();
});

const noteStorageKey = 'fluxcore_phone:quick-note';
try { elements.quickNote.value = localStorage.getItem(noteStorageKey) || ''; } catch (_) {}
elements.quickNote.addEventListener('input', () => {
  try { localStorage.setItem(noteStorageKey, elements.quickNote.value); } catch (_) {}
  elements.noteStatus.textContent = 'Saved just now';
  clearTimeout(elements.quickNote.saveTimer);
  elements.quickNote.saveTimer = setTimeout(() => { elements.noteStatus.textContent = 'Saved on this device'; }, 1400);
});
document.querySelector('#clear-note').addEventListener('click', () => {
  elements.quickNote.value = '';
  elements.quickNote.dispatchEvent(new Event('input'));
  elements.quickNote.focus();
});

function calculatorNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Error';
  return String(Math.round((number + Number.EPSILON) * 1e10) / 1e10).slice(0, 12);
}

function calculate() {
  const calc = state.calculator;
  if (calc.stored === null || !calc.operator) return Number(calc.display);
  const current = Number(calc.display);
  if (calc.operator === '+') return calc.stored + current;
  if (calc.operator === '-') return calc.stored - current;
  if (calc.operator === '*') return calc.stored * current;
  if (calc.operator === '/') return current === 0 ? NaN : calc.stored / current;
  return current;
}

function pressCalculator(key) {
  const calc = state.calculator;
  if (/^\d$/.test(key)) {
    calc.display = calc.reset || calc.display === '0' || calc.display === 'Error' ? key : `${calc.display}${key}`.slice(0, 12);
    calc.reset = false;
  } else if (key === '.') {
    if (calc.reset || calc.display === 'Error') { calc.display = '0'; calc.reset = false; }
    if (!calc.display.includes('.')) calc.display += '.';
  } else if (key === 'clear') {
    Object.assign(calc, { display: '0', stored: null, operator: null, reset: false });
  } else if (key === 'sign') {
    calc.display = calculatorNumber(Number(calc.display) * -1);
  } else if (key === 'percent') {
    calc.display = calculatorNumber(Number(calc.display) / 100);
  } else if (key === '=') {
    calc.display = calculatorNumber(calculate()); calc.stored = null; calc.operator = null; calc.reset = true;
  } else {
    if (calc.operator && !calc.reset) calc.display = calculatorNumber(calculate());
    calc.stored = Number(calc.display); calc.operator = key; calc.reset = true;
  }
  elements.calculatorDisplay.textContent = calc.display.replace('.', ',');
}

elements.calculatorKeys.addEventListener('click', (event) => {
  const button = event.target.closest('[data-calc]');
  if (button) pressCalculator(button.dataset.calc);
});

elements.cipherChannels.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-cipher-channel]');
  if (!button || button.dataset.cipherChannel === state.cipher.activeChannel) return;
  try {
    const result = await request('cipher:messages', { channel: button.dataset.cipherChannel });
    state.cipher.activeChannel = result.channel; state.cipher.messages = result.messages || []; renderCipher();
  } catch (error) { showToast(error.message, true); }
});
document.querySelector('#cipher-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const body = elements.cipherInput.value.trim(); if (!body || !state.cipher.activeChannel) return;
  try {
    const clientNonce = globalThis.crypto?.randomUUID?.() || `cipher:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    await request('cipher:send', { channel: state.cipher.activeChannel, body, clientNonce }); elements.cipherInput.value = '';
  } catch (error) { showToast(error.message, true); }
});
elements.cipherVoice.addEventListener('click', async () => {
  try {
    if (state.cipher.voiceChannel) await request('cipher:voice:leave');
    else await request('cipher:voice:join', { channel: state.cipher.activeChannel });
  } catch (error) { showToast(error.message, true); }
});

function renderDialer() {
  elements.dialerNumber.textContent = state.dialer || '\u00a0';
}
function renderCall() {
  const call = state.call;
  elements.dialerPanel.classList.toggle('is-hidden', Boolean(call));
  elements.callPanel.classList.toggle('is-hidden', !call);
  if (!call) return;
  elements.callStatus.textContent = call.status === 'incoming' ? 'Incoming call' : call.status === 'connected' ? 'Connected' : 'Calling…';
  elements.callName.textContent = call.name || call.phoneNumber;
  elements.callNumber.textContent = call.phoneNumber;
  elements.callAvatar.textContent = initials(call.name || call.phoneNumber);
  elements.acceptCall.classList.toggle('is-hidden', call.status !== 'incoming');
}
elements.dialerKeys.addEventListener('click', (event) => {
  const button = event.target.closest('[data-digit]');
  if (!button || state.dialer.length >= 15) return;
  state.dialer += button.dataset.digit; renderDialer();
});
document.querySelector('#dialer-delete').addEventListener('click', () => { state.dialer = state.dialer.slice(0, -1); renderDialer(); });
document.querySelector('#dial-button').addEventListener('click', async () => {
  if (!state.dialer) return;
  try { await request('calls:start', { phoneNumber: state.dialer }); } catch (error) { showToast(error.message, true); }
});
elements.acceptCall.addEventListener('click', async () => {
  try { await request('calls:accept'); } catch (error) { showToast(error.message, true); }
});
document.querySelector('#decline-call').addEventListener('click', async () => {
  try { await request('calls:end'); } catch (error) { showToast(error.message, true); }
});

async function closePhone() {
  await closeCustomApp();
  elements.app.classList.add('is-hidden');
  state.activeThread = null; state.messages = [];
  await nui('close');
}
document.querySelector('#close-button').addEventListener('click', () => void closePhone());

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || elements.app.classList.contains('is-hidden')) return;
  event.preventDefault(); event.stopPropagation();
  if (elements.contactDialog.open) elements.contactDialog.close();
  else if (elements.messageDialog.open) elements.messageDialog.close();
  else if (state.activeCustomApp) void goHome();
  else if (state.view === 'thread') elements.backButton.click();
  else if (state.view !== 'home') void goHome();
  else void closePhone();
});

window.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (type === 'open' || type === 'bootstrap') {
    state.locale = event.data.locale && typeof event.data.locale === 'object' ? event.data.locale : state.locale;
    state.localeName = event.data.localeName || state.localeName;
    state.apps = Array.isArray(event.data.apps) ? event.data.apps : state.apps;
    applyStaticLocale(); hydrate(payload || {});
    if (type === 'open') { state.view = 'home'; state.activeThread = null; state.messages = []; state.activeCustomApp = null; setScreen('home'); elements.app.classList.remove('is-hidden'); }
    render();
  } else if (type === 'apps') {
    state.apps = Array.isArray(payload) ? payload : []; renderApps();
  } else if (type === 'appMessage' && payload?.identifier === state.activeCustomApp) {
    elements.customAppFrame.contentWindow?.postMessage({ type: 'fluxcore:phone:message', data: payload.data }, '*');
  } else if (type === 'appRemoved' && payload?.identifier === state.activeCustomApp) {
    void goHome();
  } else if (type === 'newMessage') {
    if (state.view === 'thread' && state.activeThread?.phoneNumber === payload.peerNumber) {
      state.messages.push(payload); renderMessages(); request('messages:list', { phoneNumber: payload.peerNumber }).catch(() => {});
    } else {
      let conversation = state.conversations.find((entry) => entry.phoneNumber === payload.peerNumber);
      if (!conversation) { conversation = { phoneNumber: payload.peerNumber, name: payload.peerName, unread: 0, lastMessage: payload }; state.conversations.unshift(conversation); }
      conversation.lastMessage = payload; conversation.unread += 1; state.unread += 1; render();
    }
  } else if (type === 'messagesRead') {
    for (const message of state.messages) {
      if (message.direction === 'outgoing' && state.activeThread?.phoneNumber === payload.phoneNumber && !message.readAt) message.readAt = payload.readAt;
    }
    renderMessages();
  } else if (type === 'callState') {
    state.call = payload?.status === 'ended' ? null : payload;
    if (payload?.status === 'incoming') { state.view = 'phone'; setScreen('native'); }
    renderNative(); renderCall();
    if (payload?.status === 'ended') showToast(payload.reason || 'Call ended.');
  } else if (type === 'cipherMessage') {
    if (payload?.channel === state.cipher.activeChannel) { state.cipher.messages.push(payload); renderCipher(); }
  } else if (type === 'cipherVoice') {
    state.cipher.voiceChannel = payload?.joined ? payload.channel : null; renderCipher();
  } else if (type === 'close') {
    elements.app.classList.add('is-hidden');
  }
});

function updateClock() {
  const now = new Date();
  document.querySelector('#clock').textContent = now.toLocaleTimeString(state.localeName, { hour: '2-digit', minute: '2-digit' });
  document.querySelector('#home-date').textContent = now.toLocaleDateString(state.localeName, { weekday: 'long', day: 'numeric', month: 'long' });
  elements.clockLarge.textContent = now.toLocaleTimeString(state.localeName, { hour: '2-digit', minute: '2-digit' });
  elements.clockSeconds.textContent = now.toLocaleTimeString(state.localeName, { second: '2-digit' });
  elements.clockDate.textContent = now.toLocaleDateString(state.localeName, { weekday: 'long', day: 'numeric', month: 'long' });
  elements.clockLocal.textContent = elements.clockLarge.textContent;
  elements.clockUtc.textContent = now.toLocaleTimeString(state.localeName, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
updateClock(); setInterval(updateClock, 1000);

if (new URLSearchParams(location.search).has('preview')) {
  state.account = { name: 'Patrik Flux', phoneNumber: '51234567' };
  state.contacts = [{ id: 1, name: 'Mia Strand', phoneNumber: '59876543' }];
  state.conversations = [{ name: 'Mia Strand', phoneNumber: '59876543', unread: 2, lastMessage: { body: 'Møtes vi ved garasjen?', sentAt: new Date().toISOString() } }];
  state.unread = 2;
  elements.app.classList.remove('is-hidden');
  render();
}
