'use strict';

const resourceName =
  typeof GetParentResourceName === 'function'
    ? GetParentResourceName()
    : 'fluxcore_inventory';

const elements = {
  app: document.querySelector('#app'),
  close: document.querySelector('#close'),
  playerLabel: document.querySelector('#player-label'),
  playerSlots: document.querySelector('#player-slots'),
  playerWeight: document.querySelector('#player-weight'),
  playerWeightBar: document.querySelector('#player-weight-bar'),
  playerGrid: document.querySelector('#player-grid'),
  secondaryPanel: document.querySelector('#secondary-panel'),
  secondaryLabel: document.querySelector('#secondary-label'),
  secondarySlots: document.querySelector('#secondary-slots'),
  secondaryWeight: document.querySelector('#secondary-weight'),
  secondaryWeightBar: document.querySelector('#secondary-weight-bar'),
  secondaryGrid: document.querySelector('#secondary-grid'),
  selection: document.querySelector('#selection'),
  selectionLabel: document.querySelector('#selection-label'),
  selectionDetails: document.querySelector('#selection-details'),
  selectionIcon: document.querySelector('.selection-icon'),
  amount: document.querySelector('#amount'),
  use: document.querySelector('#use'),
  transfer: document.querySelector('#transfer'),
  drop: document.querySelector('#drop'),
  feedback: document.querySelector('#feedback'),
};

let state = { player: null, secondary: null, capabilities: {} };
let selected = null;
let busy = false;
let dragged = null;
let pendingDrag = null;
let suppressClick = false;

async function request(method, payload = {}) {
  try {
    const response = await fetch(`https://${resourceName}/inventoryRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ method, payload }),
    });
    return await response.json();
  } catch {
    return { ok: false, error: { message: 'Inventory request failed.' } };
  }
}

function text(element, value) {
  element.textContent = value == null ? '' : String(value);
}

function kilograms(value) {
  return `${((Number(value) || 0) / 1000).toFixed(1)} kg`;
}

function itemAt(container, slot) {
  return (container?.items || []).find((item) => Number(item.slot) === slot);
}

function clearDragState() {
  dragged = null;
  pendingDrag = null;
  document.querySelectorAll('.slot.dragging, .slot.drop-target').forEach((slot) => {
    slot.classList.remove('dragging', 'drop-target');
  });
}

function slotFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest?.('.slot');
  if (!slot) return null;
  return {
    element: slot,
    side: slot.dataset.side,
    slot: Number(slot.dataset.slot),
  };
}

function updateDropTarget(x, y) {
  document.querySelectorAll('.slot.drop-target').forEach((slot) => {
    slot.classList.remove('drop-target');
  });
  const target = slotFromPoint(x, y);
  if (target && canDropOn(target.side, target.slot)) {
    target.element.classList.add('drop-target');
  }
  return target;
}

function canDropOn(side, slot) {
  return Boolean(
    !busy &&
    state.capabilities?.move &&
    dragged &&
    state[side] &&
    itemAt(state[dragged.side], dragged.slot) &&
    (dragged.side !== side || dragged.slot !== slot)
  );
}

async function moveDraggedItem(side, slot) {
  if (!canDropOn(side, slot)) return;
  const source = dragged;
  clearDragState();
  await perform('move', {
    from: source.side,
    to: side,
    fromSlot: source.slot,
    toSlot: slot,
  });
}

function renderContainer(container, side, grid, label, slots, weight, bar) {
  if (!container) return;
  text(label, container.label || (side === 'player' ? 'Player inventory' : 'Container'));
  text(slots, `${container.slots || 0} slots`);
  text(weight, `${kilograms(container.weight)} / ${kilograms(container.maxWeight)}`);
  bar.style.width = `${Math.min(100, ((container.weight || 0) / Math.max(1, container.maxWeight || 1)) * 100)}%`;
  grid.replaceChildren();

  for (let slot = 1; slot <= Number(container.slots || 0); slot += 1) {
    const item = itemAt(container, slot);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `slot${item ? '' : ' empty'}`;
    button.dataset.side = side;
    button.dataset.slot = String(slot);
    button.classList.toggle('movable', Boolean(item && state.capabilities?.move));
    if (side === 'player' && (state.hotbar || []).includes(slot)) {
      button.classList.add('hotbar');
      button.title = `Hotbar ${slot}`;
    }
    if (selected?.side === side && selected.slot === slot) button.classList.add('selected');

    const number = document.createElement('span');
    number.className = 'slot-number';
    text(number, slot);
    button.append(number);

    if (item) {
      const amount = document.createElement('span');
      amount.className = 'slot-amount';
      text(amount, `×${item.amount}`);
      const icon = document.createElement('span');
      icon.className = 'slot-icon';
      const image = document.createElement('img');
      image.className = 'slot-image';
      image.src = `images/items/${encodeURIComponent(item.name)}.png`;
      image.alt = '';
      const fallback = document.createElement('span');
      fallback.className = 'slot-fallback';
      text(
        fallback,
        String(item.label || item.name || '?').slice(0, 1).toUpperCase(),
      );
      image.addEventListener('error', () => {
        image.classList.add('hidden');
        fallback.classList.remove('hidden');
      }, { once: true });
      fallback.classList.add('hidden');
      icon.append(image, fallback);
      const itemLabel = document.createElement('span');
      itemLabel.className = 'slot-label';
      text(itemLabel, item.label || item.name);
      button.append(amount, icon, itemLabel);
      button.addEventListener('click', () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        select(side, slot);
      });
      button.addEventListener('dblclick', () => {
        select(side, slot);
        void primaryAction();
      });
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || busy || !state.capabilities?.move) return;
        pendingDrag = {
          side,
          slot,
          source: button,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
        button.setPointerCapture?.(event.pointerId);
      });
    }
    grid.append(button);
  }
}

function render() {
  renderContainer(
    state.player, 'player', elements.playerGrid, elements.playerLabel,
    elements.playerSlots, elements.playerWeight, elements.playerWeightBar,
  );
  elements.secondaryPanel.classList.toggle('hidden', !state.secondary);
  if (state.secondary) {
    renderContainer(
      state.secondary, 'secondary', elements.secondaryGrid,
      elements.secondaryLabel, elements.secondarySlots,
      elements.secondaryWeight, elements.secondaryWeightBar,
    );
  }
  renderSelection();
}

function select(side, slot) {
  selected = { side, slot };
  elements.amount.value = '1';
  text(elements.feedback, '');
  elements.feedback.classList.remove('error');
  render();
}

function selectedItem() {
  return selected ? itemAt(state[selected.side], selected.slot) : null;
}

function renderSelection() {
  const item = selectedItem();
  elements.selection.classList.toggle('empty', !item);
  text(elements.selectionIcon, item ? String(item.label || item.name).slice(0, 1).toUpperCase() : '•');
  text(elements.selectionLabel, item ? item.label || item.name : 'Select an item');
  text(
    elements.selectionDetails,
    item
      ? `${item.amount} available · ${kilograms(item.totalWeight)}`
      : 'Choose a slot to manage it',
  );
  const canTransfer = Boolean(item && state.secondary && state.capabilities?.transfer);
  elements.use.disabled = busy || !item || selected?.side !== 'player' || !state.capabilities?.use;
  elements.drop.disabled = busy || !item || selected?.side !== 'player' || !state.capabilities?.drop;
  elements.transfer.disabled = busy || !canTransfer;
  text(elements.transfer, selected?.side === 'secondary' ? 'Take item' : 'Transfer');
}

function amount() {
  const item = selectedItem();
  return Math.max(1, Math.min(Number(item?.amount || 1), Math.floor(Number(elements.amount.value) || 1)));
}

async function perform(method, payload) {
  if (busy) return;
  busy = true;
  renderSelection();
  text(elements.feedback, 'Working…');
  const response = await request(method, payload);
  busy = false;
  elements.feedback.classList.toggle('error', !response?.ok);
  text(elements.feedback, response?.ok ? 'Done' : response?.error?.message || 'Request failed');
  if (response?.ok && response.data?.contract) {
    state = response.data;
    selected = null;
    render();
  } else {
    renderSelection();
  }
}

async function primaryAction() {
  if (!selectedItem()) return;
  if (selected.side === 'secondary' && state.secondary) {
    await transfer();
  } else if (state.capabilities?.use) {
    await use();
  }
}

async function use() {
  if (!selectedItem() || selected.side !== 'player') return;
  await perform('use', { side: 'player', slot: selected.slot });
}

async function drop() {
  if (!selectedItem() || selected.side !== 'player') return;
  await perform('drop', { side: 'player', slot: selected.slot, amount: amount() });
}

async function transfer() {
  if (!selectedItem() || !state.secondary) return;
  const from = selected.side;
  const to = from === 'player' ? 'secondary' : 'player';
  await perform('transfer', {
    from,
    to,
    fromSlot: selected.slot,
    amount: amount(),
  });
}

async function close() {
  elements.app.classList.add('hidden');
  clearDragState();
  selected = null;
  await request('close');
}

elements.close.addEventListener('click', () => void close());
elements.use.addEventListener('click', () => void use());
elements.drop.addEventListener('click', () => void drop());
elements.transfer.addEventListener('click', () => void transfer());

window.addEventListener('pointermove', (event) => {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
  const distance = Math.hypot(
    event.clientX - pendingDrag.startX,
    event.clientY - pendingDrag.startY,
  );
  if (!dragged && distance < 6) return;
  if (!dragged) {
    dragged = { side: pendingDrag.side, slot: pendingDrag.slot };
    pendingDrag.source.classList.add('dragging');
    suppressClick = true;
  }
  event.preventDefault();
  updateDropTarget(event.clientX, event.clientY);
});

window.addEventListener('pointerup', (event) => {
  if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;
  const target = dragged ? slotFromPoint(event.clientX, event.clientY) : null;
  if (target && canDropOn(target.side, target.slot)) {
    void moveDraggedItem(target.side, target.slot);
    return;
  }
  clearDragState();
});

window.addEventListener('pointercancel', clearDragState);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.app.classList.contains('hidden')) {
    void close();
  }
});

window.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.action === 'Fluxcore:inventory:open') {
    state = message.payload || {};
    selected = null;
    elements.app.classList.remove('hidden');
    render();
  } else if (message.action === 'Fluxcore:inventory:update') {
    state = { ...state, ...(message.payload || {}) };
    render();
  } else if (message.action === 'Fluxcore:inventory:error') {
    elements.feedback.classList.add('error');
    text(elements.feedback, message.message || 'Inventory request failed');
  } else if (message.action === 'Fluxcore:inventory:close') {
    elements.app.classList.add('hidden');
    clearDragState();
    selected = null;
  }
});
