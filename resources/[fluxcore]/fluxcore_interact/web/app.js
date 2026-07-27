'use strict';

const resourceName =
  typeof GetParentResourceName === 'function'
    ? GetParentResourceName()
    : 'fluxcore_interact';

const elements = {
  targetReticle: document.querySelector('#target-reticle'),
  interaction: document.querySelector('#interaction'),
  interactionHint: document.querySelector('#interaction-hint'),
  targetOptions: document.querySelector('#target-options'),
  interactionCount: document.querySelector('#interaction-count'),
  menu: document.querySelector('#menu'),
  menuTitle: document.querySelector('#menu-title'),
  menuDescription: document.querySelector('#menu-description'),
  menuOptions: document.querySelector('#menu-options'),
  dialog: document.querySelector('#dialog'),
  dialogForm: document.querySelector('#dialog-form'),
  dialogTitle: document.querySelector('#dialog-title'),
  dialogDescription: document.querySelector('#dialog-description'),
  dialogLabel: document.querySelector('#dialog-label'),
  dialogInput: document.querySelector('#dialog-input'),
  dialogError: document.querySelector('#dialog-error'),
  notifications: document.querySelector('#notifications'),
  progress: document.querySelector('#progress'),
  progressLabel: document.querySelector('#progress-label'),
  progressCancel: document.querySelector('#progress-cancel'),
  progressBar: document.querySelector('#progress-bar'),
};
const translations = {
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Confirm',
  options: 'options',
  escapeToCancel: 'ESC to cancel',
  required: 'A value is required',
};

async function nuiCallback(name, payload = {}) {
  const response = await fetch(`https://${resourceName}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

function setText(element, value) {
  element.textContent = value == null ? '' : String(value);
}

function show(element) {
  element.classList.remove('hidden');
}

function hide(element) {
  element.classList.add('hidden');
}

function renderTargetOptions(data = {}) {
  const options = Array.isArray(data.options) ? data.options : [];
  elements.targetOptions.replaceChildren();

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'target-option';
    button.dataset.optionId = option.id;

    const label = document.createElement('span');
    setText(label, option.label);
    button.append(label);

    if (option.description) {
      const description = document.createElement('small');
      setText(description, option.description);
      button.append(description);
    }

    button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await nuiCallback('selectTarget', { id: option.id });
      if (!result.ok) {
        button.disabled = false;
      }
    });
    elements.targetOptions.append(button);
  }

  const isScrollable = options.length > 4;
  elements.interaction.classList.toggle('is-scrollable', isScrollable);
  setText(
    elements.interactionCount,
    isScrollable
      ? `${options.length} ${translations.options} · scroll`
      : '',
  );
  elements.targetOptions.scrollTop = 0;
}

function openMenu(data = {}) {
  setText(elements.menuTitle, data.title || 'Menu');
  setText(elements.menuDescription, data.description || '');
  elements.menuDescription.hidden = !data.description;
  elements.menuOptions.replaceChildren();

  for (const option of data.options || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = option.disabled === true;
    button.dataset.optionId = option.id;

    const label = document.createElement('span');
    setText(label, option.label);
    button.append(label);

    if (option.description) {
      const description = document.createElement('small');
      description.className = 'option-description';
      setText(description, option.description);
      button.append(description);
    }

    button.addEventListener('click', () => {
      void nuiCallback('selectMenu', { id: option.id });
    });
    elements.menuOptions.append(button);
  }
  show(elements.menu);
  elements.menuOptions.querySelector('button:not(:disabled)')?.focus();
}

function openDialog(data = {}) {
  setText(elements.dialogTitle, data.title || 'Input');
  setText(elements.dialogDescription, data.description || '');
  elements.dialogDescription.hidden = !data.description;
  setText(elements.dialogLabel, data.label || 'Value');
  elements.dialogInput.placeholder = data.placeholder || '';
  elements.dialogInput.value = data.value || '';
  elements.dialogInput.required = data.required === true;
  elements.dialogInput.maxLength = Number(data.maxLength) || 255;
  setText(elements.dialogError, '');
  show(elements.dialog);
  elements.dialogInput.focus();
  elements.dialogInput.select();
}

function showNotification(data = {}) {
  const notification = document.createElement('article');
  notification.className = `notification ${data.type || 'inform'}`;
  notification.dataset.id = data.id || '';

  if (data.title) {
    const title = document.createElement('strong');
    setText(title, data.title);
    notification.append(title);
  }

  const description = document.createElement('span');
  setText(description, data.description || '');
  notification.append(description);
  elements.notifications.append(notification);

  window.setTimeout(() => notification.remove(), Number(data.duration) || 4000);
}

function openProgress(data = {}) {
  setText(elements.progressLabel, data.label || 'Working');
  setText(
    elements.progressCancel,
    data.canCancel ? translations.escapeToCancel : '',
  );
  elements.progressBar.style.animation = 'none';
  void elements.progressBar.offsetWidth;
  elements.progressBar.style.animation =
    `fill-progress ${Number(data.duration) || 1000}ms linear forwards`;
  show(elements.progress);
}

window.addEventListener('message', (event) => {
  const { action, data } = event.data || {};
  switch (action) {
    case 'config':
      Object.assign(translations, data || {});
      setText(document.querySelector('[data-close-menu]'), translations.close);
      setText(document.querySelector('[data-close-dialog]'), translations.cancel);
      setText(document.querySelector('[data-confirm-dialog]'), translations.confirm);
      break;
    case 'target:active':
      elements.targetReticle.classList.toggle('hidden', data?.active !== true);
      if (data?.active !== true) {
        elements.targetReticle.classList.remove('has-target');
        elements.interaction.classList.remove('is-focused');
        hide(elements.interaction);
      }
      break;
    case 'target:focus':
      elements.interaction.classList.toggle(
        'is-focused',
        data?.active === true,
      );
      break;
    case 'interaction:show':
      renderTargetOptions(data);
      elements.targetReticle.classList.add('has-target');
      show(elements.interaction);
      break;
    case 'interaction:hide':
      elements.targetReticle.classList.remove('has-target');
      elements.interaction.classList.remove('is-focused', 'is-scrollable');
      elements.targetOptions.replaceChildren();
      hide(elements.interaction);
      break;
    case 'menu:open':
      openMenu(data);
      break;
    case 'menu:close':
      hide(elements.menu);
      break;
    case 'dialog:open':
      openDialog(data);
      break;
    case 'dialog:close':
      hide(elements.dialog);
      break;
    case 'notification:show':
      showNotification(data);
      break;
    case 'progress:open':
      openProgress(data);
      break;
    case 'progress:close':
      hide(elements.progress);
      elements.progressBar.style.animation = 'none';
      break;
    default:
      break;
  }
});

document.querySelector('[data-close-menu]').addEventListener('click', () => {
  void nuiCallback('closeMenu');
});

document.querySelector('[data-close-dialog]').addEventListener('click', () => {
  void nuiCallback('closeDialog');
});

elements.dialogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = await nuiCallback('submitDialog', {
    value: elements.dialogInput.value,
  });
  if (!result.ok) {
    setText(elements.dialogError, result.error || translations.required);
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (!elements.dialog.classList.contains('hidden')) {
    void nuiCallback('closeDialog');
  } else if (!elements.menu.classList.contains('hidden')) {
    void nuiCallback('closeMenu');
  } else if (!elements.progress.classList.contains('hidden')) {
    void nuiCallback('cancelProgress');
  } else if (elements.interaction.classList.contains('is-focused')) {
    void nuiCallback('releaseTargetFocus');
  }
});
