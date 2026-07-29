'use strict';

const app = document.querySelector('#app');
const resource = window.GetParentResourceName?.() || 'fluxcore_appearance';
const fields = Object.fromEntries([...document.querySelectorAll('input, select')].map((element) => [element.id, element]));
let base = null;
let previewTimer = null;

async function post(name, data = {}) {
  if (!window.GetParentResourceName) return { ok: true };
  const response = await fetch(`https://${resource}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });
  return response.json();
}

function drawable(entries, id, fallback = 0) {
  return entries?.find((value) => Number(value.componentId) === id)?.drawable ?? fallback;
}

function currentAppearance() {
  const components = (base?.components || []).filter((value) => ![2, 4, 6, 11].includes(Number(value.componentId)));
  components.push(
    { componentId: 2, drawable: Number(fields.hair.value), texture: 0, palette: 0 },
    { componentId: 4, drawable: Number(fields.legs.value), texture: 0, palette: 0 },
    { componentId: 6, drawable: Number(fields.shoes.value), texture: 0, palette: 0 },
    { componentId: 11, drawable: Number(fields.top.value), texture: 0, palette: 0 },
  );
  const headOverlays = (base?.headOverlays || []).filter((value) => Number(value.overlayId) !== 1);
  headOverlays.push({
    overlayId: 1, value: Number(fields.beard.value),
    opacity: Number(fields.beard.value) === 0 ? 0 : 1, colorType: 1,
    color: Number(fields.hairColor.value), secondaryColor: 0,
  });
  return {
    ...(base || {}), version: 1, model: fields.model.value, components, headOverlays,
    headBlend: {
      shapeFirst: Number(fields.shapeFirst.value), shapeSecond: Number(fields.shapeSecond.value), shapeThird: 0,
      skinFirst: Number(fields.skinFirst.value), skinSecond: Number(fields.skinSecond.value), skinThird: 0,
      shapeMix: Number(fields.shapeMix.value), skinMix: Number(fields.skinMix.value), thirdMix: 0,
    },
    hairColor: Number(fields.hairColor.value),
    hairHighlight: Number(fields.hairColor.value),
    eyeColor: Number(fields.eyeColor.value),
  };
}

function hydrate(value) {
  base = structuredClone(value);
  const blend = value.headBlend || {};
  fields.model.value = value.model || 'mp_m_freemode_01';
  for (const name of ['shapeFirst', 'shapeSecond', 'skinFirst', 'skinSecond']) fields[name].value = Number(blend[name] || 0);
  fields.shapeMix.value = Number(blend.shapeMix ?? .5);
  fields.skinMix.value = Number(blend.skinMix ?? .5);
  fields.hair.value = drawable(value.components, 2);
  fields.top.value = drawable(value.components, 11);
  fields.legs.value = drawable(value.components, 4);
  fields.shoes.value = drawable(value.components, 6);
  fields.hairColor.value = Number(value.hairColor || 0);
  fields.eyeColor.value = Number(value.eyeColor || 0);
  fields.beard.value = value.headOverlays?.find((item) => Number(item.overlayId) === 1)?.value || 0;
}

function preview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => post('appearancePreview', currentAppearance()), 70);
}

for (const field of Object.values(fields)) field.addEventListener('input', preview);
document.querySelector('#left').addEventListener('click', () => post('appearanceRotate', { amount: -15 }));
document.querySelector('#right').addEventListener('click', () => post('appearanceRotate', { amount: 15 }));
document.querySelector('#cancel').addEventListener('click', () => post('appearanceCancel'));
document.querySelector('#save').addEventListener('click', () => post('appearanceSave', currentAppearance()));
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') post('appearanceCancel'); });
window.addEventListener('message', (event) => {
  if (event.data?.action === 'appearance:open') {
    hydrate(event.data.appearance || {});
    app.classList.remove('is-hidden');
  } else if (event.data?.action === 'appearance:close') {
    app.classList.add('is-hidden');
  }
});
