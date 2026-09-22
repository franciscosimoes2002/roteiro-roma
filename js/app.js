/* ============================================================
   Roteiro Roma — ligação entre o estado, o mapa e a interface.
   ============================================================ */

import { CATEGORIES, CATEGORY_KEYS, TICKET_GUIDE, ROME_SEED, WALK_KMH } from './config.js';
import { FOOD, FOOD_PHRASE, FOOD_AVOID, FOOD_QUICK, allDishes, dishIcon, dishSearch } from './food.js';
import { placeLink, dayRouteLink } from './links.js';
import * as S from './store.js';
import * as M from './maps.js';
import * as P from './places.js';
import * as AI from './ai.js';

/* ---------- atalhos ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = M.escapeHtml;
const cat = (k) => CATEGORIES[k] || CATEGORIES.other;
const cur = () => S.state.settings.currency || '€';

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtDate = (iso) => {
  if (!iso) return 'sem data';
  const d = new Date(iso + 'T12:00:00');
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
/** Versão curta, para caber na barra de topo de um telemóvel. */
const fmtDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const fmtMoney = (n) => `${Math.round(n * 100) / 100} ${cur()}`;
const fmtDur = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

/* ---------- estado local da interface ---------- */
let lastRoute = null;       // resultado da Directions API para o dia ativo
let weather = {};           // { '2026-04-12': {icon,min,max,rain} }
let searchResults = [];
let pendingActions = null;  // propostas da IA por aplicar
let routeToken = 0;         // evita respostas fora de ordem

/* ============================================================
   1. ARRANQUE
   ============================================================ */

function fillSettingsForm() {
  const s = S.state.settings;
  $('#set-gmaps-key').value = s.gmapsKey;
  $('#set-map-id').value = s.mapId;
  $('#set-gmaps-version').value = s.gmapsVersion;
  $('#set-ai-provider').value = s.aiProvider || 'openai';
  $('#set-openai-key').value = s.openaiKey || '';
  setOpenAIModelOptions(s.openaiModel ? [s.openaiModel] : [], s.openaiModel);
  $('#set-ai-key').value = s.aiKey;
  $('#set-ai-model').value = s.aiModel;
  $('#set-ai-effort').value = s.aiEffort;
  showProviderFields(s.aiProvider || 'openai');
  $('#set-travelers').value = s.travelers;
  $('#set-currency').value = s.currency;
  $('#set-home').value = s.home;
  $('#set-prefs').value = s.prefs;
}

async function boot() {
  fillSettingsForm();
  $('#trip-name').value = S.state.trip.name;
  $('#trip-start').value = S.state.trip.start;

  buildCategorySelect();
  renderTicketGuide();
  renderFoodStatic();
  renderAll();
  wireEvents();

  S.subscribe((what) => {
    renderAll();
    if (what === 'itinerary' || what === 'activeDay' || what === 'days' || what === 'all') {
      syncMapWithDay();
    }
  });

  wireOffline();
  registerServiceWorker();

  await tryInitMap();
  loadWeather();
}

/* ---------- funcionar sem rede ---------- */

function wireOffline() {
  const bar = $('#offline-bar');
  const sync = () => {
    const off = !navigator.onLine;
    bar.hidden = !off;
    document.body.classList.toggle('is-offline', off);
    if (off && !M.isReady()) {
      $('#map-missing').hidden = false;
      $('#map-missing .map-missing-card h3').textContent = 'Sem ligação';
      $('#map-missing .map-missing-card p').textContent =
        'O mapa precisa de internet. O roteiro, os bilhetes e a checklist de comida continuam todos aqui.';
    }
  };
  addEventListener('online', sync);
  addEventListener('offline', sync);
  sync();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        // só avisa se já havia uma versão instalada antes
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Há uma versão nova. <button class="linklike" id="sw-reload">atualizar</button>', 9000);
          setTimeout(() => {
            $('#sw-reload')?.addEventListener('click', () => {
              sw.postMessage('skip-waiting');
              location.reload();
            });
          }, 50);
        }
      });
    });
  } catch (e) {
    console.warn('Service worker não registado:', e?.message);
  }
}

async function tryInitMap() {
  const s = S.state.settings;
  if (!s.gmapsKey) { $('#map-missing').hidden = false; return; }
  try {
    await M.initMap($('#map'), s);
    $('#map-missing').hidden = true;
    syncMapWithDay();
    M.probe3dPhoto().then((ok) => {
      $('#btn-p3d').disabled = !ok;
      if (!ok && S.state.ui.view === 'p3d') S.state.ui.view = '3d';
      setView(S.state.ui.view || '2d');
    });
  } catch (e) {
    if (String(e.message) === 'reload-needed') {
      toast('A chave mudou — recarrega a página (F5) para o mapa usar a nova.');
      return;
    }
    console.error(e);
    $('#map-missing').hidden = false;
    $('#map-missing .map-missing-card h3').textContent = 'O mapa não carregou';
    $('#map-missing .map-missing-card p').innerHTML =
      'Confirma que a chave é válida e que tens ativas a <strong>Maps JavaScript API</strong>, '
      + 'a <strong>Places API (New)</strong> e a <strong>Directions API</strong>.';
  }
}

/* ============================================================
   2. DESENHAR A INTERFACE
   ============================================================ */

function renderAll() {
  renderTopbar();
  renderDaysStrip();
  renderDayHead();
  renderItinerary();
  renderTotals();
  renderSaved();
  renderFood();
  renderBookings();
}

function renderTopbar() {
  $('#stat-days').textContent = S.days().length;
  $('#stat-items').textContent = S.totalItems();
  $('#stat-cost').textContent = fmtMoney(S.totalCost());
  $('#trip-end-label').textContent = fmtDateShort(S.endDate());
}

function renderDaysStrip() {
  const strip = $('#days-strip');
  strip.innerHTML = '';
  S.days().forEach((day, i) => {
    const date = S.dayDate(i);
    const wx = weather[date];
    const b = document.createElement('button');
    b.className = 'day-chip' + (i === S.state.ui.activeDay ? ' active' : '');
    b.dataset.day = i;
    b.innerHTML = `<b>Dia ${i + 1}</b><small>${date ? date.slice(8) + '/' + date.slice(5, 7) : '—'}`
      + ` · ${day.items.length}${wx ? ' ' + wx.icon : ''}</small>`;
    // largar uma paragem em cima do cartão do dia move-a para lá (ver endDrag)
    b.onclick = () => { if (!justDragged) S.setActiveDay(i); };
    strip.appendChild(b);
  });

  // acrescentar / remover dias fica junto dos dias: na barra de topo não
  // cabia num telemóvel
  const tools = document.createElement('div');
  tools.className = 'days-tools';
  tools.innerHTML = `<button class="day-tool" id="btn-day-add" title="Acrescentar um dia">+</button>`
    + (S.days().length > 1
      ? `<button class="day-tool" id="btn-day-remove" title="Remover o último dia">−</button>` : '');
  tools.querySelector('#btn-day-add').onclick = () => S.addDay();
  tools.querySelector('#btn-day-remove')?.addEventListener('click', () => {
    const last = S.days().at(-1);
    if (last.items.length && !confirm(`O dia ${S.days().length} tem ${last.items.length} paragens. Apagar mesmo assim?`)) return;
    S.removeLastDay();
  });
  strip.appendChild(tools);
}

function renderDayHead() {
  const i = S.state.ui.activeDay;
  const day = S.activeDay();
  const date = S.dayDate(i);
  const wx = weather[date];
  $('#day-title').textContent = `Dia ${i + 1}`;
  $('#day-meta').innerHTML = fmtDate(date)
    + (wx ? ` · <span class="wx">${wx.icon} ${wx.min}–${wx.max}°C${wx.rain > 30 ? ` · ${wx.rain}% chuva` : ''}</span>` : '');

  const noteBox = $('#day-note');
  if (day.note && noteBox.hidden) showDayNote(true);
  else if (!noteBox.hidden) {
    const ta = noteBox.querySelector('textarea');
    if (ta && ta.value !== day.note) ta.value = day.note;
  }
}

function showDayNote(show) {
  const box = $('#day-note');
  box.hidden = !show;
  if (!show) return;
  box.innerHTML = '<textarea rows="2" placeholder="Nota deste dia: reservas, quem faz o quê, lembretes…"></textarea>';
  const ta = box.querySelector('textarea');
  ta.value = S.activeDay().note || '';
  ta.oninput = () => { S.activeDay().note = ta.value; S.save(); };
}

function renderItinerary() {
  const list = $('#itinerary');
  const day = S.activeDay();
  list.innerHTML = '';

  if (!day.items.length) {
    list.innerHTML = `<div class="empty-day">Dia ainda vazio.<br>
      Procura sítios em <b>Explorar</b>, ou pede à <b>IA</b> para montar o dia.</div>`;
    return;
  }

  day.items.forEach((it, idx) => {
    const c = cat(it.category);
    const li = document.createElement('li');
    li.className = `stop cat-${c.group}`;
    li.dataset.id = it.id;

    const pills = [
      it.time ? `<span class="pill time">${it.time}</span>` : '',
      it.duration ? `<span class="pill">${fmtDur(it.duration)}</span>` : '',
      it.cost ? `<span class="pill">${fmtMoney(it.cost)}</span>` : '',
      it.ref ? `<span class="pill booked">🎟️ ${esc(it.ref)}</span>` : '',
      it.rating ? `<span class="pill">★ ${it.rating}</span>` : '',
    ].filter(Boolean).join('');

    li.innerHTML = `
      <button class="stop-idx" title="Arrastar para reordenar (ou setas ↑ ↓)"
        aria-label="Paragem ${idx + 1}: arrastar para reordenar">${idx + 1}</button>
      <div class="stop-main">
        <div class="stop-title"><span class="emo">${c.emoji}</span> ${esc(it.name)}</div>
        <div class="stop-sub">${pills}${it.address ? `<span>${esc(it.address)}</span>` : ''}</div>
        ${it.notes ? `<div class="stop-notes">${esc(it.notes)}</div>` : ''}
      </div>
      <div class="stop-actions">
        <button class="mini" data-act="edit" title="Editar">✎</button>
        <button class="mini" data-act="nav" title="Abrir na app Google Maps">➤</button>
        <button class="mini" data-act="map" title="Ver no mapa da app">◎</button>
        <button class="mini" data-act="del" title="Remover">✕</button>
      </div>`;

    li.querySelector('[data-act="nav"]').onclick = (e) => {
      e.stopPropagation();
      const url = placeLink(it);
      if (url) window.open(url, '_blank', 'noopener');
      else toast('Esta paragem não tem morada nem localização.');
    };

    li.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openItemDialog(it.id); };
    li.querySelector('[data-act="del"]').onclick = (e) => {
      e.stopPropagation();
      S.removeItem(it.id);
      toast('Paragem removida.');
    };
    li.querySelector('[data-act="map"]').onclick = (e) => {
      e.stopPropagation();
      if (Number.isFinite(it.lat)) { M.focusOn(it.lat, it.lng); showMapOnMobile(); }
      else toast('Esta paragem não tem localização no mapa.');
    };
    li.onclick = () => {
      if (justDragged) return;          // o toque que acabou um arrasto não conta como clique
      $$('.stop').forEach((s) => s.classList.remove('selected'));
      li.classList.add('selected');
      if (Number.isFinite(it.lat)) M.focusOn(it.lat, it.lng, 16);
    };

    wireDrag(li);
    list.appendChild(li);

    if (idx < day.items.length - 1) {
      const leg = document.createElement('div');
      leg.className = 'leg';
      leg.dataset.leg = idx;
      leg.innerHTML = legText(idx, it, day.items[idx + 1]);
      list.appendChild(leg);
    }
  });
}

/** Texto da deslocação entre duas paragens (usa a Directions API quando existe). */
function legText(idx, a, b) {
  const modeIcon = { WALKING: '🚶', TRANSIT: '🚇', DRIVING: '🚗', BICYCLING: '🚲' }[S.state.ui.travelMode];
  const real = lastRoute?.legs?.[idx];
  if (real) return `${modeIcon} <b>${real.text}</b>`;
  if (Number.isFinite(a.lat) && Number.isFinite(b.lat)) {
    const km = haversine(a, b) * 1.3;             // fator de ruas
    const min = Math.round((km / WALK_KMH) * 60);
    return `${modeIcon} <b>~${min} min</b> · ~${km.toFixed(1)} km <span class="muted">(estimativa)</span>`;
  }
  return `${modeIcon} <span class="muted">—</span>`;
}

function updateLegs() {
  const day = S.activeDay();
  $$('.leg').forEach((el) => {
    const i = Number(el.dataset.leg);
    if (day.items[i] && day.items[i + 1]) el.innerHTML = legText(i, day.items[i], day.items[i + 1]);
  });
}

function haversine(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function renderTotals() {
  const day = S.activeDay();
  const visit = S.dayMinutes(day);
  const travel = lastRoute?.totalMin ?? estimateTravel(day.items);
  $('#day-totals').innerHTML = `
    <span>Visitas: <b>${fmtDur(visit)}</b></span>
    <span>Deslocações: <b>${fmtDur(travel)}</b></span>
    <span>Dia: <b>${fmtDur(visit + travel)}</b></span>
    <span>Custo: <b>${fmtMoney(S.dayCost(day))}</b></span>`;
}

function estimateTravel(items) {
  let min = 0;
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i], b = items[i + 1];
    if (Number.isFinite(a.lat) && Number.isFinite(b.lat)) min += Math.round((haversine(a, b) * 1.3 / WALK_KMH) * 60);
  }
  return min;
}

/* ============================================================
   3. ARRASTAR E LARGAR (rato e dedo)

   Usa Pointer Events em vez de HTML5 drag-and-drop, que simplesmente
   não existe em ecrãs táteis. Arrasta-se pelo número da paragem; o
   resto da lista continua a deslizar normalmente com o dedo.
   ============================================================ */

let drag = null;
let justDragged = false;

function wireDrag(li) {
  const handle = li.querySelector('.stop-idx');
  handle.addEventListener('pointerdown', (e) => beginDrag(e, li, handle));
  handle.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const found = S.findItem(li.dataset.id);
    if (!found) return;
    const to = found.index + step;
    if (to < 0 || to >= S.days()[found.dayIndex].items.length) return;
    S.moveItem(li.dataset.id, found.dayIndex, to);
    // devolve o foco ao mesmo item depois de a lista ser redesenhada
    requestAnimationFrame(() => $(`.stop[data-id="${li.dataset.id}"] .stop-idx`)?.focus());
  });
}

function beginDrag(e, li, handle) {
  if (e.button > 0) return;
  e.preventDefault();

  const rect = li.getBoundingClientRect();
  const ghost = li.cloneNode(true);
  ghost.className = 'stop drag-ghost';
  ghost.style.width = `${rect.width}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.appendChild(ghost);

  drag = {
    id: li.dataset.id, li, ghost,
    dy: e.clientY - rect.top, dx: e.clientX - rect.left,
    target: null, after: false, dayTarget: null, moved: false,
  };
  li.classList.add('dragging');
  handle.setPointerCapture?.(e.pointerId);

  const onMove = (ev) => moveDrag(ev);
  const onEnd = (ev) => {
    endDrag(ev);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onEnd);
    document.removeEventListener('pointercancel', onEnd);
  };
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onEnd);
  document.addEventListener('pointercancel', onEnd);
}

function moveDrag(e) {
  if (!drag) return;
  e.preventDefault();
  drag.moved = true;
  drag.ghost.style.left = `${e.clientX - drag.dx}px`;
  drag.ghost.style.top = `${e.clientY - drag.dy}px`;

  clearDropMarks();
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const stop = under?.closest?.('.stop:not(.drag-ghost)');
  const chip = under?.closest?.('.day-chip');

  drag.target = null;
  drag.dayTarget = null;

  if (chip) {
    chip.classList.add('drop-hover');
    drag.dayTarget = Number(chip.dataset.day);
  } else if (stop && stop.dataset.id !== drag.id) {
    const r = stop.getBoundingClientRect();
    drag.after = e.clientY > r.top + r.height / 2;
    stop.classList.toggle('drop-after', drag.after);
    stop.classList.toggle('drop-before', !drag.after);
    drag.target = stop.dataset.id;
  }

  autoScroll(e.clientY);
}

/** Faz a lista deslizar sozinha quando se arrasta junto às bordas. */
function autoScroll(y) {
  const pane = $('#pane-roteiro');
  const r = pane.getBoundingClientRect();
  const margin = 60;
  if (y < r.top + margin) pane.scrollTop -= 12;
  else if (y > r.bottom - margin) pane.scrollTop += 12;
}

function clearDropMarks() {
  $$('.stop').forEach((s) => s.classList.remove('drop-before', 'drop-after'));
  $$('.day-chip').forEach((c) => c.classList.remove('drop-hover'));
}

function endDrag() {
  if (!drag) return;
  const { id, li, ghost, target, after, dayTarget, moved } = drag;
  ghost.remove();
  li.classList.remove('dragging');
  clearDropMarks();
  drag = null;

  justDragged = moved;
  setTimeout(() => (justDragged = false), 60);
  if (!moved) return;

  if (dayTarget !== null && dayTarget !== undefined) {
    const src = S.findItem(id);
    if (src && src.dayIndex !== dayTarget) {
      S.moveItem(id, dayTarget);
      toast(`Movido para o dia ${dayTarget + 1}.`);
    }
    return;
  }

  if (!target) return;
  const dst = S.findItem(target);
  const src = S.findItem(id);
  if (!dst || !src) return;
  let pos = dst.index + (after ? 1 : 0);
  if (src.dayIndex === dst.dayIndex && src.index < pos) pos--;
  S.moveItem(id, dst.dayIndex, pos);
}

/* ============================================================
   4. MAPA
   ============================================================ */

function syncMapWithDay() {
  if (!M.isReady()) { renderTotals(); return; }
  const items = S.activeDay().items;
  M.renderDayMarkers(items, (it) => {
    const li = $(`.stop[data-id="${it.id}"]`);
    li?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $$('.stop').forEach((s) => s.classList.toggle('selected', s.dataset.id === it.id));
  });
  M.refresh3d(items);
  recomputeRoute();
}

async function recomputeRoute() {
  const token = ++routeToken;
  const items = S.activeDay().items;
  const summary = $('#route-summary');

  if (!M.isReady() || items.filter((i) => Number.isFinite(i.lat)).length < 2) {
    lastRoute = null;
    M.clearRoute?.();
    summary.hidden = true;
    updateLegs();
    renderTotals();
    return;
  }

  const depart = departureDate();
  const res = await M.drawRoute(items, S.state.ui.travelMode, depart);
  if (token !== routeToken) return;             // chegou uma resposta mais recente
  lastRoute = res;
  updateLegs();
  renderTotals();

  if (res) {
    summary.hidden = false;
    summary.innerHTML = `<span>Trajeto do dia: <b>${fmtDur(res.totalMin)}</b></span>
      <span><b>${res.totalKm.toFixed(1)} km</b></span>
      <span>${items.length} paragens</span>`;
  } else {
    summary.hidden = true;
  }
}

function departureDate() {
  const date = S.dayDate(S.state.ui.activeDay);
  const first = S.activeDay().items.find((i) => i.time)?.time || '09:00';
  if (!date) return null;
  const d = new Date(`${date}T${first}:00`);
  return d > new Date() ? d : null;             // a API só aceita horas futuras
}

async function setView(view) {
  S.state.ui.view = view;
  S.save();
  $$('#view-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const host = $('#map3d-host');
  if (view === 'p3d') {
    const ok = await M.show3dPhoto(host, S.activeDay().items);
    if (!ok) { toast('O mapa 3D fotorrealista não está disponível nesta versão da API. Experimenta pôr a versão em <b>beta</b> nas definições.'); setView('3d'); }
    return;
  }
  M.hide3dPhoto(host);
  M.setTilt(view === '3d');
}

function showMapOnMobile() {
  if (window.matchMedia('(max-width: 900px)').matches) document.body.classList.add('show-map');
}

/* ============================================================
   5. EXPLORAR
   ============================================================ */

async function doSearch(query, type = null) {
  const box = $('#results');
  if (!M.isReady()) {
    renderResults(ROME_SEED, 'Sem a chave da Google Maps não há pesquisa. Ficam aqui os clássicos de Roma.');
    return;
  }
  box.innerHTML = '<div class="skeleton"><span class="spinner"></span> a procurar…</div>';
  const area = $('#search-near-map').checked ? M.visibleBounds() : null;
  try {
    const res = type && area
      ? await P.searchNearby(type, area)
      : await P.searchText(query, area);
    searchResults = res;
    renderResults(res);
    M.renderSearchMarkers(res, (p) => openPlaceDialog(p));
    $('#search-count').textContent = `${res.length} resultados`;
    if (!res.length) box.innerHTML = '<div class="skeleton">Não encontrei nada. Tenta outras palavras.</div>';
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="skeleton">Falhou: ${esc(e.message)}<br>
      <span class="muted small">Confirma que a <b>Places API (New)</b> está ativa na tua chave.</span></div>`;
  }
}

function placeCard(p, saved = false) {
  const c = cat(p.category);
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    ${p.photo ? `<img class="thumb" src="${p.photo}" alt="" loading="lazy">` : `<div class="thumb">${c.emoji}</div>`}
    <div class="card-body">
      <div class="card-title">${esc(p.name)}</div>
      <div class="card-meta">
        ${p.rating ? `<span class="rating">★ ${p.rating}</span>` : ''}
        ${p.reviews ? `<span>(${p.reviews})</span>` : ''}
        ${p.price ? `<span>${p.price}</span>` : ''}
        <span>${c.label}</span>
        ${p.closed ? '<span style="color:#d9534f">fechado permanentemente</span>' : ''}
      </div>
      <div class="card-meta">${esc(p.address || '')}</div>
      <div class="card-actions">
        <button class="btn tiny" data-a="add">+ Dia ${S.state.ui.activeDay + 1}</button>
        <button class="btn tiny ghost" data-a="save">${saved || S.isSaved(p) ? '★ guardado' : '☆ guardar'}</button>
        <button class="btn tiny ghost" data-a="info">detalhes</button>
      </div>
    </div>`;

  el.querySelector('[data-a="add"]').onclick = (e) => { e.stopPropagation(); addPlaceToDay(p, S.state.ui.activeDay); };
  el.querySelector('[data-a="save"]').onclick = (e) => {
    e.stopPropagation();
    const added = S.toggleSaved(p);
    toast(added ? 'Guardado na lista.' : 'Retirado da lista.');
  };
  el.querySelector('[data-a="info"]').onclick = (e) => { e.stopPropagation(); openPlaceDialog(p); };
  el.onclick = () => { if (Number.isFinite(p.lat)) { M.focusOn(p.lat, p.lng); showMapOnMobile(); } };
  return el;
}

function renderResults(list, notice = '') {
  const box = $('#results');
  box.innerHTML = notice ? `<div class="skeleton small">${notice}</div>` : '';
  list.forEach((p) => box.appendChild(placeCard(p)));
}

function renderSaved() {
  const box = $('#saved-list');
  box.innerHTML = '';
  $('#saved-count').textContent = S.state.saved.length ? `(${S.state.saved.length})` : '';
  if (!S.state.saved.length) {
    box.innerHTML = '<div class="skeleton small">Ainda não guardaste nada. O ☆ nos resultados serve para isso.</div>';
    return;
  }
  S.state.saved.forEach((p) => box.appendChild(placeCard(p, true)));
}

/** Sugere uma hora a seguir à última paragem do dia. */
function suggestTime(dayIndex) {
  const items = S.state.trip.days[dayIndex]?.items || [];
  const last = [...items].reverse().find((i) => i.time);
  if (!last) return '';
  const [h, m] = last.time.split(':').map(Number);
  const total = h * 60 + m + (Number(last.duration) || 60) + 20;   // +20 min de deslocação
  if (total >= 24 * 60) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function addPlaceToDay(p, dayIndex, extra = {}) {
  const item = S.addItem(dayIndex, {
    name: p.name,
    category: p.category,
    placeId: p.placeId,
    lat: p.lat,
    lng: p.lng,
    address: p.address,
    rating: p.rating,
    photo: p.photo,
    time: extra.time || suggestTime(dayIndex),
    duration: extra.duration,
    cost: extra.cost,
    notes: extra.notes,
  });
  toast(`<b>${esc(p.name)}</b> adicionado ao dia ${dayIndex + 1}.`);
  return item;
}

/* ---------- ficha do sítio ---------- */

async function openPlaceDialog(p) {
  const dlg = $('#dlg-place');
  const body = $('#place-body');
  body.innerHTML = '<div class="skeleton"><span class="spinner"></span> a carregar…</div>';
  dlg.showModal();

  let d = p;
  if (p.placeId && M.isReady()) {
    try { d = await P.details(p.placeId); } catch (e) { console.warn(e); }
  }
  const c = cat(d.category);

  body.innerHTML = `
    ${d.photo ? `<img class="place-hero" src="${d.photos?.[0] || d.photo}" alt="">` : ''}
    <h2>${c.emoji} ${esc(d.name)}</h2>
    <div class="card-meta" style="margin:.3rem 0 .6rem">
      ${d.rating ? `<span class="rating">★ ${d.rating}</span>` : ''}
      ${d.reviews ? `<span>${d.reviews} avaliações</span>` : ''}
      ${d.price ? `<span>${d.price}</span>` : ''}
      ${d.openNow === true ? '<span style="color:#4fa87a">aberto agora</span>' : ''}
      ${d.openNow === false ? '<span style="color:#d9534f">fechado agora</span>' : ''}
    </div>
    ${d.summary ? `<p class="small">${esc(d.summary)}</p>` : ''}
    <p class="muted small">${esc(d.address || '')}</p>
    ${d.phone ? `<p class="small">📞 ${esc(d.phone)}</p>` : ''}
    ${d.hours ? `<div class="place-hours">${d.hours.map((h) => {
      const [dia, ...r] = h.split(': ');
      return `<div><span>${esc(dia)}</span><span>${esc(r.join(': '))}</span></div>`;
    }).join('')}</div>` : ''}
    ${d.topReview ? `<div class="place-review">“${esc(String(d.topReview.text).slice(0, 320))}”
      <div class="muted small">— ${esc(d.topReview.author || 'visitante')}</div></div>` : ''}
    <div class="dlg-actions" style="flex-wrap:wrap">
      ${d.website ? `<a class="btn ghost tiny" href="${esc(d.website)}" target="_blank" rel="noopener">site</a>` : ''}
      ${d.mapsUrl ? `<a class="btn ghost tiny" href="${esc(d.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ''}
      <span class="spacer"></span>
      <button class="btn ghost" id="pd-close">Fechar</button>
      <button class="btn" id="pd-add">Adicionar ao dia ${S.state.ui.activeDay + 1}</button>
    </div>`;

  $('#pd-close').onclick = () => dlg.close();
  $('#pd-add').onclick = () => {
    addPlaceToDay({ ...d, photo: d.photos?.[0] || d.photo }, S.state.ui.activeDay, {
      notes: d.website ? `Site: ${d.website}` : '',
    });
    dlg.close();
  };
}

/* ============================================================
   5b. COMIDA
   ============================================================ */

function renderFoodStatic() {
  $('#food-phrase').innerHTML = `
    <div style="flex:1">
      <span class="it">“${esc(FOOD_PHRASE.it)}”</span>
      <small>${esc(FOOD_PHRASE.note)}</small>
    </div>
    <button class="btn tiny ghost" id="btn-copy-phrase">copiar</button>`;
  $('#btn-copy-phrase').onclick = async () => {
    try {
      await navigator.clipboard.writeText(FOOD_PHRASE.it);
      toast('Copiado. Diz isto ao pedir.');
    } catch {
      toast('O navegador não deixou copiar.');
    }
  };
  $('#food-quick').innerHTML = FOOD_QUICK.map((q) => `<span>${esc(q)}</span>`).join('');
  $('#food-avoid').innerHTML = FOOD_AVOID.map((a) => `<li>${esc(a)}</li>`).join('');
}

/** Um prato passa o filtro atual? */
function dishVisible(d) {
  const f = S.state.food.filter;
  const q = (S.state.food.query || '').toLowerCase().trim();
  if (q && !(`${d.name} ${d.desc || ''}`.toLowerCase().includes(q))) return false;
  if (f === 'both' && d.who !== 'both') return false;
  if (f === 'todo' && S.isEaten(d.id)) return false;
  if (f === 'done' && !S.isEaten(d.id)) return false;
  return true;
}

function renderFood() {
  const box = $('#food-list');
  const all = allDishes();
  const done = all.filter((d) => S.isEaten(d.id)).length;
  const mine = all.filter((d) => d.who === 'both');
  const mineDone = mine.filter((d) => S.isEaten(d.id)).length;

  $('#food-progress-text').innerHTML =
    `<b>${done}</b> de ${all.length} pratos · para os dois: <b>${mineDone}</b>/${mine.length}`;
  $('#food-bar').style.width = `${all.length ? (done / all.length) * 100 : 0}%`;

  box.innerHTML = '';
  let shown = 0;

  FOOD.forEach((sec) => {
    const groups = sec.groups
      .map((g) => ({ ...g, dishes: g.dishes.filter(dishVisible) }))
      .filter((g) => g.dishes.length);
    if (!groups.length) return;

    const secEl = document.createElement('div');
    secEl.className = 'food-section';
    const secDishes = sec.groups.flatMap((g) => g.dishes);
    const secDone = secDishes.filter((d) => S.isEaten(d.id)).length;

    secEl.innerHTML = `
      <div class="food-section-head">
        <h3>${esc(sec.title)}</h3>
        <span class="food-badge">${esc(sec.badge)}</span>
        <span class="muted small">${secDone}/${secDishes.length}</span>
      </div>
      <p class="food-intro">${esc(sec.intro)}</p>`;

    groups.forEach((g) => {
      const gEl = document.createElement('div');
      gEl.className = 'food-group' + (g.star ? ' starred' : '');
      const gDone = g.dishes.filter((d) => S.isEaten(d.id)).length;
      gEl.innerHTML = `<div class="food-group-title">${g.star ? '★ ' : ''}${esc(g.title)}
        <span class="cnt">${gDone}/${g.dishes.length}</span></div>`;

      g.dishes.forEach((d) => {
        shown++;
        const eaten = S.isEaten(d.id);
        const when = S.eatenOn(d.id);
        const el = document.createElement('button');
        el.type = 'button';
        el.setAttribute('role', 'checkbox');
        el.setAttribute('aria-checked', String(eaten));
        el.className = 'dish' + (eaten ? ' done' : '');
        el.innerHTML = `
          <span class="dish-box" aria-hidden="true">✓</span>
          <span class="dish-body">
            <span class="dish-name">${esc(d.name)} <span class="who" title="${d.who === 'both' ? 'para os dois' : 'só para ela'}">${dishIcon(d)}</span></span>
            ${d.desc ? `<span class="dish-desc">${esc(d.desc)}</span>` : ''}
            ${eaten && when ? `<span class="dish-when">✓ ${fmtDate(when)}</span>` : ''}
          </span>
          <span class="dish-find" role="button" tabindex="0" title="Procurar onde comer">🔍</span>`;

        el.onclick = () => S.toggleDish(d.id);
        el.querySelector('.dish-find').onclick = (e) => {
          e.stopPropagation();
          const term = dishSearch(d);
          $('#search-input').value = term;
          switchTab('explorar');
          doSearch(term);
        };
        gEl.appendChild(el);
      });

      secEl.appendChild(gEl);
    });

    box.appendChild(secEl);
  });

  if (!shown) {
    box.innerHTML = '<div class="food-empty">Nada com esse filtro.</div>';
  }
}

/* ============================================================
   6. BILHETES
   ============================================================ */

function renderBookings() {
  const box = $('#bookings-list');
  const list = S.bookings();
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = `<div class="skeleton">Ainda não há nada com reserva.<br>
      <span class="small">Edita uma paragem (✎) e preenche o campo <b>Reserva / bilhete nº</b>.</span></div>`;
    return;
  }
  list.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'booking';
    el.innerHTML = `
      <div class="booking-top">
        <span>${cat(b.category).emoji} ${esc(b.name)}</span>
        <span>${b.cost ? fmtMoney(b.cost) : ''}</span>
      </div>
      <div class="booking-meta">
        Dia ${b.dayIndex + 1} · ${fmtDate(b.date)}${b.time ? ` · <b>${b.time}</b>` : ''}
        ${b.ref ? ` · <code>${esc(b.ref)}</code>` : ''}
      </div>
      ${b.address ? `<div class="booking-meta">${esc(b.address)}</div>` : ''}
      ${b.url ? `<div class="booking-meta"><a href="${esc(b.url)}" target="_blank" rel="noopener">abrir link da reserva</a></div>` : ''}`;
    el.onclick = () => { S.setActiveDay(b.dayIndex); switchTab('roteiro'); };
    box.appendChild(el);
  });
}

function renderTicketGuide() {
  const box = $('#ticket-guide');
  box.innerHTML = TICKET_GUIDE.map((t) => `
    <div class="tg">
      <div class="tg-top"><span class="tg-name">${esc(t.name)}</span><span class="tg-when">${esc(t.when)}</span></div>
      <div class="tg-desc">${esc(t.desc)}</div>
      <a href="${esc(t.url)}" target="_blank" rel="noopener">site oficial ↗</a>
      <span class="muted small"> · ${esc(t.price)}</span>
    </div>`).join('');
}

/* ============================================================
   7. IA
   ============================================================ */

function renderChat() {
  const box = $('#ai-chat');
  box.innerHTML = '';
  if (!S.state.chat.length) {
    box.innerHTML = `<div class="skeleton">Diz-me o que queres para a viagem e eu trato do roteiro.<br>
      <span class="small">Ex.: “dia 2 no Vaticano de manhã, tarde calma e jantar em Trastevere”.</span></div>`;
  }
  S.state.chat.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'msg ' + m.role;
    el.innerHTML = m.role === 'user' ? esc(m.content) : mdLite(m.content);
    box.appendChild(el);
  });
  box.scrollTop = box.scrollHeight;
}

/** Markdown mínimo: negrito, itálico, código e listas. */
function mdLite(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '• $1');
}

async function sendToAI(text) {
  if (!text.trim()) return;
  const s = S.state.settings;
  const hasKey = s.aiProvider === 'anthropic' ? s.aiKey : s.openaiKey;
  if (!hasKey) {
    openSettings();
    toast(`Primeiro cola a tua chave da ${s.aiProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'}.`);
    return;
  }

  S.state.chat.push({ role: 'user', content: text });
  S.save();
  renderChat();
  $('#ai-text').value = '';
  $('#btn-ai-send').disabled = true;

  const box = $('#ai-chat');
  const status = document.createElement('div');
  status.className = 'msg ai thinking';
  status.innerHTML = '<span class="spinner"></span> a pensar…';
  box.appendChild(status);
  box.scrollTop = box.scrollHeight;

  try {
    const history = S.state.chat.slice(0, -1);
    const { reply, actions } = await AI.ask(text, history, (s) => {
      status.innerHTML = `<span class="spinner"></span> ${s}`;
    });
    status.remove();
    S.state.chat.push({ role: 'assistant', content: reply });
    S.save();
    renderChat();
    if (actions?.length) showPending(actions);
    else $('#ai-pending').hidden = true;
  } catch (e) {
    status.remove();
    const el = document.createElement('div');
    el.className = 'msg err';
    el.textContent = e.message;
    box.appendChild(el);
  } finally {
    $('#btn-ai-send').disabled = false;
  }
}

function showPending(actions) {
  pendingActions = actions;
  const box = $('#ai-pending');
  box.hidden = false;
  box.innerHTML = `
    <h4>${actions.length} alteraç${actions.length === 1 ? 'ão' : 'ões'} ao roteiro</h4>
    <ul>${actions.map((a) => `<li>${esc(AI.describeAction(a))}${a.why ? `<br><span class="muted small">${esc(a.why)}</span>` : ''}</li>`).join('')}</ul>
    <div class="dlg-actions">
      <button class="btn ghost" id="ai-reject">Descartar</button>
      <span class="spacer"></span>
      <button class="btn" id="ai-apply">Aplicar</button>
    </div>`;
  $('#ai-reject').onclick = () => { pendingActions = null; box.hidden = true; };
  $('#ai-apply').onclick = () => applyActions(pendingActions);
}

/**
 * Aplica as ações da IA.
 * Os índices são resolvidos contra uma fotografia do estado ANTES de mexer
 * em nada, para que várias remoções no mesmo dia não se atrapalhem.
 */
async function applyActions(actions) {
  const box = $('#ai-pending');
  const btn = $('#ai-apply');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> a aplicar…'; }

  S.snapshot('ia');                       // para o botão Desfazer
  const snapshot = S.days().map((d) => d.items.map((i) => i.id));
  const idAt = (day, idx) => snapshot[(day || 1) - 1]?.[(idx || 1) - 1];
  let added = 0, failed = 0;

  for (const a of actions) {
    try {
      const di = (a.day || 1) - 1;
      switch (a.op) {
        case 'add_day':
          S.addDay();
          snapshot.push([]);
          break;

        case 'add_place': {
          let place = { name: a.name || a.query, category: a.category || 'other', lat: null, lng: null, address: '' };
          if (M.isReady() && a.query) {
            if (btn) btn.innerHTML = `<span class="spinner"></span> a localizar ${esc((a.query || '').slice(0, 24))}…`;
            const found = await P.resolveOne(a.query);
            if (found) place = { ...found, name: a.name || found.name, category: a.category || found.category };
          }
          S.addItem(Math.max(0, Math.min(di, S.days().length - 1)), {
            ...place,
            time: a.time || '',
            duration: a.duration_min ?? undefined,
            cost: a.cost ?? undefined,
            notes: a.note || '',
          }, a.to_index != null ? a.to_index - 1 : null);
          added++;
          break;
        }

        case 'remove_item': {
          const id = idAt(a.day, a.item_index);
          if (id) S.removeItem(id); else failed++;
          break;
        }

        case 'move_item': {
          const id = idAt(a.day, a.item_index);
          if (id) S.moveItem(id, (a.to_day || a.day) - 1, a.to_index != null ? a.to_index - 1 : null);
          else failed++;
          break;
        }

        case 'update_item': {
          const id = idAt(a.day, a.item_index);
          if (!id) { failed++; break; }
          const patch = {};
          if (a.time) patch.time = a.time;
          if (a.duration_min != null) patch.duration = a.duration_min;
          if (a.cost != null) patch.cost = a.cost;
          if (a.name) patch.name = a.name;
          if (a.category && CATEGORIES[a.category]) patch.category = a.category;
          if (a.note) patch.notes = a.note;
          S.updateItem(id, patch);
          break;
        }

        case 'reorder_day': {
          const day = S.days()[di];
          if (!day || !a.order) { failed++; break; }
          const wanted = a.order.map((n) => idAt(a.day, n)).filter(Boolean);
          const rest = day.items.map((i) => i.id).filter((id) => !wanted.includes(id));
          const ids = [...wanted, ...rest];
          day.items = ids.map((id) => day.items.find((i) => i.id === id)).filter(Boolean);
          S.emit('itinerary');
          break;
        }

        case 'set_day_note': {
          const day = S.days()[di];
          if (day) { day.note = a.note || ''; S.emit('itinerary'); }
          break;
        }

        case 'clear_day': {
          const day = S.days()[di];
          if (day) { day.items = []; S.emit('itinerary'); }
          break;
        }

        default:
          failed++;
      }
    } catch (e) {
      console.error('ação falhou', a, e);
      failed++;
    }
  }

  pendingActions = null;
  box.hidden = true;
  switchTab('roteiro');

  toast(`Roteiro atualizado${added ? ` · ${added} paragens novas` : ''}${failed ? ` · ${failed} ignoradas` : ''}.`
    + ' <button class="linklike" id="btn-undo">desfazer</button>', 9000);
  setTimeout(() => {
    $('#btn-undo')?.addEventListener('click', () => {
      if (S.undo()) toast('Roteiro reposto como estava.');
      $('#toast').hidden = true;
    });
  }, 50);
}

/* ============================================================
   8. DIÁLOGO DE PARAGEM
   ============================================================ */

let editingId = null;

function buildCategorySelect() {
  $('#it-category').innerHTML = CATEGORY_KEYS
    .map((k) => `<option value="${k}">${CATEGORIES[k].emoji} ${CATEGORIES[k].label}</option>`).join('');
}

function openItemDialog(itemId = null) {
  editingId = itemId;
  const found = itemId ? S.findItem(itemId) : null;
  const it = found?.item;

  $('#item-dlg-title').textContent = it ? 'Editar paragem' : 'Nova paragem';
  $('#it-day').innerHTML = S.days().map((_, i) => `<option value="${i}">Dia ${i + 1}</option>`).join('');
  $('#it-day').value = found ? found.dayIndex : S.state.ui.activeDay;
  $('#it-name').value = it?.name || '';
  $('#it-category').value = it?.category || 'sight';
  $('#it-time').value = it?.time || (it ? '' : suggestTime(S.state.ui.activeDay));
  $('#it-duration').value = it?.duration ?? '';
  $('#it-cost').value = it?.cost || '';
  $('#it-address').value = it?.address || '';
  $('#it-ref').value = it?.ref || '';
  $('#it-url').value = it?.url || '';
  $('#it-notes').value = it?.notes || '';
  $('#btn-item-delete').hidden = !it;
  $('#dlg-item').showModal();
}

async function saveItemDialog() {
  const data = {
    name: $('#it-name').value.trim() || 'Sem nome',
    category: $('#it-category').value,
    time: $('#it-time').value,
    duration: Number($('#it-duration').value) || 0,
    cost: Number($('#it-cost').value) || 0,
    address: $('#it-address').value.trim(),
    ref: $('#it-ref').value.trim(),
    url: $('#it-url').value.trim(),
    notes: $('#it-notes').value,
  };
  const targetDay = Number($('#it-day').value);

  if (editingId) {
    const found = S.findItem(editingId);
    S.updateItem(editingId, data);
    if (found && found.dayIndex !== targetDay) S.moveItem(editingId, targetDay);
  } else {
    // sem coordenadas? tenta encontrar o sítio pelo nome
    let coords = {};
    if (M.isReady()) {
      const found = await P.resolveOne(`${data.name} ${data.address}`.trim());
      if (found) coords = { lat: found.lat, lng: found.lng, placeId: found.placeId, address: data.address || found.address };
    }
    S.addItem(targetDay, { ...data, ...coords });
  }
  $('#dlg-item').close();
}

/* ============================================================
   9. DEFINIÇÕES, EXPORTAÇÃO, EVENTOS
   ============================================================ */

function openSettings() { fillSettingsForm(); $('#dlg-settings').showModal(); }

function showProviderFields(provider) {
  $('#ai-openai').hidden = provider !== 'openai';
  $('#ai-anthropic').hidden = provider !== 'anthropic';
}

function setOpenAIModelOptions(models, selected = '') {
  const sel = $('#set-openai-model');
  const list = models.length ? models : [];
  sel.innerHTML = `<option value="">automático (o melhor da conta)</option>`
    + list.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  sel.value = selected && list.includes(selected) ? selected : '';
}

async function loadOpenAIModels() {
  const key = $('#set-openai-key').value.trim();
  const hint = $('#model-hint');
  if (!key) { hint.textContent = 'Cola primeiro a chave da OpenAI.'; return; }
  const btn = $('#btn-load-models');
  btn.disabled = true;
  hint.innerHTML = '<span class="spinner"></span> a consultar a tua conta…';
  try {
    const models = await AI.listOpenAIModels(key);
    setOpenAIModelOptions(models, S.state.settings.openaiModel);
    const best = await AI.pickBestOpenAIModel(key);
    hint.innerHTML = `${models.length} modelos disponíveis. Em automático usa o <b>${esc(best)}</b>.`;
  } catch (e) {
    hint.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

async function saveSettings() {
  const s = S.state.settings;
  const keyChanged = s.gmapsKey !== $('#set-gmaps-key').value.trim();
  Object.assign(s, {
    gmapsKey: $('#set-gmaps-key').value.trim(),
    mapId: $('#set-map-id').value.trim() || 'DEMO_MAP_ID',
    gmapsVersion: $('#set-gmaps-version').value,
    aiProvider: $('#set-ai-provider').value,
    openaiKey: $('#set-openai-key').value.trim(),
    openaiModel: $('#set-openai-model').value,
    aiKey: $('#set-ai-key').value.trim(),
    aiModel: $('#set-ai-model').value,
    aiEffort: $('#set-ai-effort').value,
    travelers: Number($('#set-travelers').value) || 2,
    currency: $('#set-currency').value || '€',
    home: $('#set-home').value.trim(),
    prefs: $('#set-prefs').value.trim(),
  });
  S.emit('settings');
  if (keyChanged) await tryInitMap();
}

function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = () => (S.state.trip.name || 'roteiro').toLowerCase().replace(/[^a-z0-9]+/g, '-');

function printItinerary() {
  const s = S.state.settings;
  const html = `<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8">
  <title>${esc(S.state.trip.name)}</title><style>
    body{font:14px/1.5 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#222}
    h1{font-size:1.6rem;margin:0 0 .2rem} .sub{color:#777;margin-bottom:1.6rem}
    h2{font-size:1.05rem;margin:1.6rem 0 .4rem;border-bottom:2px solid #e0733c;padding-bottom:.2rem}
    .it{display:flex;gap:.7rem;padding:.45rem 0;border-bottom:1px solid #eee;break-inside:avoid}
    .n{width:22px;height:22px;border-radius:50%;background:#e0733c;color:#fff;display:grid;place-items:center;font-size:.72rem;flex:0 0 auto;font-weight:700}
    .t{font-weight:600} .m{color:#777;font-size:.82rem} .nt{font-size:.82rem;margin-top:.15rem}
    .ref{background:#fdf3e6;border:1px solid #e9c99b;padding:0 .3rem;border-radius:4px;font-size:.78rem}
    .note{background:#faf6f0;padding:.4rem .6rem;border-radius:6px;font-size:.85rem;margin:.3rem 0}
    .fd{font-size:.84rem;padding:.14rem 0;break-inside:avoid}
    @media print{body{margin:0}}
  </style></head><body>
  <h1>${esc(S.state.trip.name)}</h1>
  <div class="sub">${S.days().length} dias · ${S.totalItems()} paragens · ${fmtMoney(S.totalCost())} · ${s.travelers} viajantes</div>
  ${S.days().map((day, di) => `
    <h2>Dia ${di + 1} — ${fmtDate(S.dayDate(di))}</h2>
    ${day.note ? `<div class="note">${esc(day.note)}</div>` : ''}
    ${day.items.length ? day.items.map((it, i) => `
      <div class="it"><div class="n">${i + 1}</div><div>
        <div class="t">${cat(it.category).emoji} ${esc(it.name)}</div>
        <div class="m">${[it.time, it.duration ? fmtDur(it.duration) : '', it.cost ? fmtMoney(it.cost) : '', it.address]
          .filter(Boolean).map(esc).join(' · ')}</div>
        ${it.ref ? `<div class="nt"><span class="ref">Reserva ${esc(it.ref)}</span></div>` : ''}
        ${it.notes ? `<div class="nt">${esc(it.notes)}</div>` : ''}
      </div></div>`).join('') : '<div class="m">—</div>'}`).join('')}

  <h2 style="page-break-before:always">Checklist de comida</h2>
  <div class="m" style="margin-bottom:.6rem">🧀 leva queijo · 🐟 peixe · 🌿 para os dois &nbsp;·&nbsp; “${esc(FOOD_PHRASE.it)}”</div>
  ${FOOD.map((sec) => `
    <h3 style="font-size:.95rem;margin:.9rem 0 .3rem">${esc(sec.title)}</h3>
    ${sec.groups.map((g) => `
      <div class="m" style="margin-top:.4rem">${esc(g.title)}</div>
      ${g.dishes.map((d) => `<div class="fd">${S.isEaten(d.id) ? '☑' : '☐'} ${dishIcon(d)} ${esc(d.name)}
        ${d.desc ? `<span class="m">— ${esc(d.desc)}</span>` : ''}</div>`).join('')}`).join('')}`).join('')}

  <h3 style="font-size:.95rem;margin:1rem 0 .3rem">O que evitar</h3>
  ${FOOD_AVOID.map((a) => `<div class="fd">✕ ${esc(a)}</div>`).join('')}
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('O navegador bloqueou a janela de impressão.'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tabpane').forEach((p) => p.classList.toggle('active', p.id === `pane-${name}`));
  if (name === 'ia') renderChat();
  if (name === 'explorar' && !$('#results').children.length) renderResults(ROME_SEED);
  if (window.matchMedia('(max-width: 900px)').matches) document.body.classList.remove('show-map');
}

async function loadWeather() {
  const start = S.state.trip.start;
  if (!start) return;
  const end = S.dayDate(S.days().length - 1);
  const limit = new Date(); limit.setDate(limit.getDate() + 15);
  if (new Date(start + 'T12:00:00') > limit) return;      // fora do alcance da previsão
  weather = await P.forecast(start, end);
  renderDaysStrip();
  renderDayHead();
}

/* ---------- eventos ---------- */

function wireEvents() {
  // separadores
  $$('.tab').forEach((t) => (t.onclick = () => switchTab(t.dataset.tab)));

  // viagem
  $('#trip-name').oninput = (e) => { S.state.trip.name = e.target.value; S.save(); };
  $('#trip-start').onchange = (e) => { S.state.trip.start = e.target.value; S.emit('days'); loadWeather(); };
  // (os botões de acrescentar/remover dia são criados em renderDaysStrip)

  // dia
  $('#btn-day-note').onclick = () => showDayNote($('#day-note').hidden);
  $('#btn-day-maps').onclick = () => {
    const route = dayRouteLink(S.activeDay().items, S.state.ui.travelMode);
    if (!route) { toast('Preciso de pelo menos duas paragens com localização.'); return; }
    window.open(route.url, '_blank', 'noopener');
    if (route.skipped) toast(`A Google só aceita 11 paragens de cada vez — ficaram ${route.skipped} de fora.`, 4500);
  };
  $('#btn-add-manual').onclick = () => openItemDialog(null);
  $('#btn-optimize').onclick = async () => {
    const items = S.activeDay().items;
    if (items.length < 4) { toast('Preciso de pelo menos 4 paragens para valer a pena.'); return; }
    if (!M.isReady()) { toast('A otimização precisa do mapa ativo.'); return; }
    toast('<span class="spinner"></span> a calcular a melhor ordem…');
    const order = await M.optimizeOrder(items, S.state.ui.travelMode);
    if (!order) { toast('Não consegui otimizar este dia.'); return; }
    S.reorderDay(S.state.ui.activeDay, order);
    toast('Ordem otimizada — a primeira e a última paragem ficaram no sítio.');
  };

  // pesquisa
  $('#btn-search').onclick = () => doSearch($('#search-input').value.trim());
  $('#search-input').onkeydown = (e) => { if (e.key === 'Enter') doSearch(e.target.value.trim()); };
  $$('#search-chips .chip').forEach((c) => {
    c.onclick = () => {
      $('#search-input').value = c.dataset.q;
      doSearch(c.dataset.q, c.dataset.type);
    };
  });

  // comida
  $('#food-search').oninput = (e) => { S.state.food.query = e.target.value; S.save(); renderFood(); };
  $$('#food-filters .chip').forEach((c) => (c.onclick = () => {
    S.state.food.filter = c.dataset.filter;
    S.save();
    $$('#food-filters .chip').forEach((x) => x.classList.toggle('active', x === c));
    renderFood();
  }));
  $('#btn-food-reset').onclick = () => {
    if (confirm('Desmarcar todos os pratos da checklist?')) S.clearFood();
  };

  // IA
  $('#btn-ai-send').onclick = () => sendToAI($('#ai-text').value);
  $('#ai-text').onkeydown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendToAI(e.target.value); }
  };
  $$('.ai-quick .chip').forEach((c) => (c.onclick = () => sendToAI(c.dataset.prompt)));
  $('#btn-ai-clear').onclick = () => { S.state.chat = []; S.save(); renderChat(); $('#ai-pending').hidden = true; };

  // mapa
  $$('#view-seg .seg-btn').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $$('#mode-seg .seg-btn').forEach((b) => (b.onclick = () => {
    S.state.ui.travelMode = b.dataset.mode;
    S.save();
    $$('#mode-seg .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
    recomputeRoute();
  }));
  $('#btn-fit').onclick = () => M.fitToItems(S.activeDay().items);
  $('#btn-rot-l').onclick = () => M.rotate(-45);
  $('#btn-rot-r').onclick = () => M.rotate(45);
  $('#btn-toggle-map').onclick = () => document.body.classList.toggle('show-map');

  // definições
  $('#btn-settings').onclick = openSettings;
  $('#btn-open-settings-2').onclick = openSettings;
  $('#btn-save-settings').onclick = () => saveSettings();
  $('#set-ai-provider').onchange = (e) => showProviderFields(e.target.value);
  $('#btn-load-models').onclick = () => loadOpenAIModels();
  $('#btn-reset').onclick = () => {
    if (confirm('Isto apaga o roteiro, os guardados e as chaves guardadas neste navegador. Continuar?')) {
      S.resetAll();
      fillSettingsForm();
      $('#dlg-settings').close();
    }
  };

  // paragem
  $('#btn-item-save').onclick = () => saveItemDialog();
  $('#btn-item-cancel').onclick = () => $('#dlg-item').close();
  $('#btn-item-delete').onclick = () => {
    if (editingId) S.removeItem(editingId);
    $('#dlg-item').close();
  };

  // exportar
  const menu = $('#menu-export');
  $('#btn-export').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => (menu.hidden = true));
  menu.onclick = (e) => {
    const act = e.target.dataset?.export;
    if (!act) return;
    if (act === 'json') download(`${slug()}.json`, S.exportJSON());
    if (act === 'ics') download(`${slug()}.ics`, S.exportICS(), 'text/calendar');
    if (act === 'print') printItinerary();
    if (act === 'import') $('#file-import').click();
  };
  $('#file-import').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      S.importJSON(await f.text());
      toast('Roteiro importado.');
    } catch (err) {
      toast('Ficheiro inválido: ' + esc(err.message));
    }
    e.target.value = '';
  };

  // teclas
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight') S.setActiveDay(S.state.ui.activeDay + 1);
    if (e.key === 'ArrowLeft') S.setActiveDay(S.state.ui.activeDay - 1);
  });

  // repor o estado visual guardado
  $$('#mode-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === S.state.ui.travelMode));
  $('#food-search').value = S.state.food.query || '';
  $$('#food-filters .chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === (S.state.food.filter || 'all')));
}

boot();
