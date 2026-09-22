/* ============================================================
   Estado da aplicação: guardado no navegador (localStorage),
   com exportação/importação em ficheiro.
   ============================================================ */

import { CATEGORIES, CURRENCY_DEFAULT } from './config.js';

const KEY = 'roteiro-roma:v1';
const listeners = new Set();

export const uid = () => Math.random().toString(36).slice(2, 10);

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function blankDay(date) {
  return { id: uid(), date: date || '', note: '', items: [] };
}

function defaultState() {
  return {
    version: 1,
    trip: {
      name: 'Roma a dois',
      start: todayISO(30),
      days: [blankDay(), blankDay(), blankDay(), blankDay()],
    },
    saved: [],
    food: { checked: {}, filter: 'all', query: '' },
    settings: {
      gmapsKey: '',
      mapId: 'DEMO_MAP_ID',
      gmapsVersion: 'weekly',
      aiProvider: 'openai',
      openaiKey: '',
      openaiModel: '',          // vazio = a app escolhe o melhor da conta
      aiKey: '',                // Anthropic
      aiModel: 'claude-opus-5',
      aiEffort: 'high',
      travelers: 2,
      currency: CURRENCY_DEFAULT,
      home: '',
      prefs: '',
    },
    ui: { activeDay: 0, travelMode: 'WALKING', view: '2d' },
    chat: [],
  };
}

/* ---------- carregar / gravar ---------- */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    // fusão superficial para que versões antigas ganhem campos novos
    return {
      ...base,
      ...parsed,
      trip: { ...base.trip, ...parsed.trip },
      settings: { ...base.settings, ...parsed.settings },
      ui: { ...base.ui, ...parsed.ui },
      food: { ...base.food, ...parsed.food, checked: parsed.food?.checked || {} },
      saved: parsed.saved || [],
      chat: parsed.chat || [],
    };
  } catch (e) {
    console.warn('Estado inválido, a recomeçar.', e);
    return defaultState();
  }
}

export const state = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Não foi possível gravar o estado', e);
    }
  }, 200);
}

/* ---------- reatividade mínima ---------- */

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notifica os ouvintes e grava. `what` diz que zonas mudaram. */
export function emit(what = 'all') {
  save();
  for (const fn of listeners) {
    try { fn(what); } catch (e) { console.error(e); }
  }
}

/* ---------- dias ---------- */

export const days = () => state.trip.days;
export const activeDay = () => state.trip.days[state.ui.activeDay] || state.trip.days[0];

export function dayDate(index) {
  if (!state.trip.start) return '';
  const d = new Date(state.trip.start + 'T12:00:00');
  d.setDate(d.getDate() + index);
  return d.toISOString().slice(0, 10);
}

export function endDate() {
  return dayDate(state.trip.days.length - 1);
}

export function addDay() {
  state.trip.days.push(blankDay());
  state.ui.activeDay = state.trip.days.length - 1;
  emit('days');
}

export function removeLastDay() {
  if (state.trip.days.length <= 1) return;
  state.trip.days.pop();
  state.ui.activeDay = Math.min(state.ui.activeDay, state.trip.days.length - 1);
  emit('days');
}

export function setActiveDay(i) {
  if (i < 0 || i >= state.trip.days.length || i === state.ui.activeDay) return;
  state.ui.activeDay = i;
  emit('activeDay');
}

/* ---------- paragens ---------- */

export function makeItem(data = {}) {
  const category = CATEGORIES[data.category] ? data.category : 'other';
  return {
    id: uid(),
    name: data.name || 'Sem nome',
    category,
    placeId: data.placeId || null,
    lat: typeof data.lat === 'number' ? data.lat : null,
    lng: typeof data.lng === 'number' ? data.lng : null,
    address: data.address || '',
    time: data.time || '',
    duration: Number.isFinite(data.duration) ? data.duration : CATEGORIES[category].defaultMin,
    cost: Number.isFinite(data.cost) ? data.cost : 0,
    notes: data.notes || '',
    ref: data.ref || '',
    url: data.url || '',
    rating: data.rating ?? null,
    photo: data.photo || null,
  };
}

export function addItem(dayIndex, data, atIndex = null) {
  const day = state.trip.days[dayIndex];
  if (!day) return null;
  const item = makeItem(data);
  if (atIndex === null || atIndex < 0 || atIndex > day.items.length) day.items.push(item);
  else day.items.splice(atIndex, 0, item);
  emit('itinerary');
  return item;
}

export function findItem(itemId) {
  for (let d = 0; d < state.trip.days.length; d++) {
    const i = state.trip.days[d].items.findIndex((x) => x.id === itemId);
    if (i !== -1) return { dayIndex: d, index: i, item: state.trip.days[d].items[i] };
  }
  return null;
}

export function updateItem(itemId, patch) {
  const found = findItem(itemId);
  if (!found) return;
  Object.assign(found.item, patch);
  emit('itinerary');
}

export function removeItem(itemId) {
  const found = findItem(itemId);
  if (!found) return;
  state.trip.days[found.dayIndex].items.splice(found.index, 1);
  emit('itinerary');
}

/** Move uma paragem para outro dia e/ou outra posição. */
export function moveItem(itemId, toDay, toIndex = null) {
  const found = findItem(itemId);
  if (!found) return;
  const target = state.trip.days[toDay];
  if (!target) return;
  const [it] = state.trip.days[found.dayIndex].items.splice(found.index, 1);
  const pos = toIndex === null || toIndex > target.items.length ? target.items.length : Math.max(0, toIndex);
  target.items.splice(pos, 0, it);
  emit('itinerary');
}

export function reorderDay(dayIndex, order) {
  const day = state.trip.days[dayIndex];
  if (!day) return;
  const next = order.map((i) => day.items[i]).filter(Boolean);
  if (next.length !== day.items.length) return;
  day.items = next;
  emit('itinerary');
}

/* ---------- guardados (lista de desejos) ---------- */

export function toggleSaved(place) {
  const i = state.saved.findIndex((p) => (p.placeId && p.placeId === place.placeId) || p.name === place.name);
  if (i !== -1) state.saved.splice(i, 1);
  else state.saved.push(place);
  emit('saved');
  return i === -1;
}

export const isSaved = (place) =>
  state.saved.some((p) => (p.placeId && p.placeId === place.placeId) || p.name === place.name);

/* ---------- checklist de comida ---------- */

export const isEaten = (dishId) => !!state.food.checked[dishId];

export function toggleDish(dishId) {
  if (state.food.checked[dishId]) delete state.food.checked[dishId];
  else state.food.checked[dishId] = new Date().toISOString().slice(0, 10);
  emit('food');
  return isEaten(dishId);
}

/** Data em que se comeu (ISO) ou null. */
export const eatenOn = (dishId) => state.food.checked[dishId] || null;

export function clearFood() {
  state.food.checked = {};
  emit('food');
}

/* ---------- valores derivados ---------- */

export function dayCost(day) {
  return day.items.reduce((s, it) => s + (Number(it.cost) || 0), 0);
}

export function totalCost() {
  return state.trip.days.reduce((s, d) => s + dayCost(d), 0);
}

export function totalItems() {
  return state.trip.days.reduce((s, d) => s + d.items.length, 0);
}

export function dayMinutes(day) {
  return day.items.reduce((s, it) => s + (Number(it.duration) || 0), 0);
}

/**
 * Paragens que são mesmo uma reserva: têm código de confirmação, ou um
 * link de reserva com hora marcada. Ter custo e hora não chega — senão
 * todos os jantares planeados apareciam aqui.
 */
export function bookings() {
  const out = [];
  state.trip.days.forEach((day, di) => {
    day.items.forEach((it) => {
      if (it.ref || (it.time && it.url)) {
        out.push({ ...it, dayIndex: di, date: dayDate(di) });
      }
    });
  });
  return out.sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
}

/* ---------- importar / exportar ---------- */

export function exportJSON() {
  const settings = { ...state.settings, aiKey: '', gmapsKey: '', openaiKey: '' };
  return JSON.stringify({ trip: state.trip, saved: state.saved, food: state.food, settings }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data.trip || !Array.isArray(data.trip.days)) throw new Error('Ficheiro sem roteiro válido.');
  state.trip = { ...state.trip, ...data.trip };
  state.trip.days = data.trip.days.map((d) => ({
    id: d.id || uid(),
    date: d.date || '',
    note: d.note || '',
    items: (d.items || []).map((it) => makeItem(it)),
  }));
  if (Array.isArray(data.saved)) state.saved = data.saved;
  if (data.food?.checked) state.food = { ...state.food, ...data.food };
  // as chaves de API que já estão no navegador mantêm-se
  if (data.settings) {
    const { aiKey, gmapsKey, openaiKey, ...rest } = data.settings;
    Object.assign(state.settings, rest);
  }
  state.ui.activeDay = 0;
  emit('all');
}

/* ---------- desfazer ----------
   Guarda uma cópia do roteiro antes de uma alteração grande (as da IA,
   sobretudo), para dar sempre um caminho de volta. */

let undoSnapshot = null;

export function snapshot(label = '') {
  undoSnapshot = { label, trip: JSON.parse(JSON.stringify(state.trip)) };
}

export const canUndo = () => undoSnapshot !== null;

export function undo() {
  if (!undoSnapshot) return false;
  state.trip = undoSnapshot.trip;
  undoSnapshot = null;
  state.ui.activeDay = Math.min(state.ui.activeDay, state.trip.days.length - 1);
  emit('all');
  return true;
}

export function resetAll() {
  localStorage.removeItem(KEY);
  Object.assign(state, defaultState());
  emit('all');
}

/* ---------- ficheiro .ics para o calendário ---------- */

export function exportICS() {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = (date, time, addMin = 0) => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (time || '09:00').split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm + addMin);
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  };
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roteiro Roma//PT', 'CALSCALE:GREGORIAN',
  ];

  state.trip.days.forEach((day, di) => {
    const date = dayDate(di);
    if (!date) return;
    day.items.forEach((it) => {
      const desc = [it.notes, it.ref ? `Reserva: ${it.ref}` : '', it.url].filter(Boolean).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${it.id}@roteiro-roma`,
        `DTSTART;TZID=Europe/Rome:${stamp(date, it.time)}`,
        `DTEND;TZID=Europe/Rome:${stamp(date, it.time, Number(it.duration) || 60)}`,
        `SUMMARY:${esc(CATEGORIES[it.category].emoji + ' ' + it.name)}`,
        it.address ? `LOCATION:${esc(it.address)}` : '',
        desc ? `DESCRIPTION:${esc(desc)}` : '',
        'END:VEVENT',
      );
    });
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}
