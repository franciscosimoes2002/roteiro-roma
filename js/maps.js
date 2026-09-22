/* ============================================================
   Google Maps: mapa 2D/3D, marcadores numerados e trajetos.
   ============================================================ */

import { ROME, CATEGORIES } from './config.js';

let map = null;            // google.maps.Map (2D / 3D inclinado)
let map3d = null;          // Map3DElement (fotorrealista)
let infoWindow = null;
let dirService = null;
let dirRenderer = null;
let dayMarkers = [];
let searchMarkers = [];
let route3dLine = null;
let libs = {};
let loadedKey = null;
let has3dPhoto = null;     // null = por testar

export const isReady = () => map !== null;
export const getMap = () => map;

/* ---------- carregador oficial da API (bootstrap dinâmico) ---------- */
function bootstrap(params) {
  ((g) => {
    let h, a, k, p = 'The Google Maps JavaScript API', c = 'google', l = 'importLibrary', q = '__ib__',
      m = document, b = window;
    b = b[c] || (b[c] = {});
    const d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
      u = () => h || (h = new Promise(async (f, n) => {
        a = m.createElement('script');
        e.set('libraries', [...r] + '');
        for (k in g) e.set(k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()), g[k]);
        e.set('callback', c + '.maps.' + q);
        a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
        d[q] = f;
        a.onerror = () => (h = n(Error(p + ' could not load.')));
        a.nonce = m.querySelector('script[nonce]')?.nonce || '';
        m.head.append(a);
      }));
    d[l] ? console.warn(p + ' only loads once. Ignoring:', g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
  })(params);
}

/**
 * Carrega a API e cria o mapa. Devolve true se correu bem.
 */
export async function initMap(container, settings) {
  if (!settings.gmapsKey) return false;
  if (map && loadedKey === settings.gmapsKey) return true;

  if (!loadedKey) {
    bootstrap({
      key: settings.gmapsKey,
      v: settings.gmapsVersion || 'weekly',
      language: 'pt-PT',
      region: 'IT',
    });
    loadedKey = settings.gmapsKey;
  } else if (loadedKey !== settings.gmapsKey) {
    // a API só carrega uma vez por página
    throw new Error('reload-needed');
  }

  const [mapsLib, markerLib, routesLib, geomLib] = await Promise.all([
    google.maps.importLibrary('maps'),
    google.maps.importLibrary('marker'),
    google.maps.importLibrary('routes'),
    google.maps.importLibrary('geometry'),
  ]);
  libs = { ...mapsLib, ...markerLib, ...routesLib, geometry: geomLib };

  map = new libs.Map(container, {
    center: ROME.center,
    zoom: ROME.defaultZoom,
    mapId: settings.mapId || 'DEMO_MAP_ID',
    mapTypeControl: false,
    streetViewControl: true,
    fullscreenControl: false,
    zoomControl: true,
    tiltInteractionEnabled: true,
    headingInteractionEnabled: true,
    clickableIcons: true,
    gestureHandling: 'greedy',
  });

  infoWindow = new libs.InfoWindow({ maxWidth: 260 });
  dirService = new libs.DirectionsService();
  dirRenderer = new libs.DirectionsRenderer({
    map,
    suppressMarkers: true,
    preserveViewport: true,
    polylineOptions: { strokeColor: '#e0733c', strokeWeight: 5, strokeOpacity: 0.9 },
  });

  return true;
}

/* ---------- marcadores ---------- */

function pin(glyphText, color, scale = 1) {
  const glyph = document.createElement('span');
  glyph.className = 'pin-lbl';
  glyph.textContent = glyphText;
  return new libs.PinElement({
    background: color,
    borderColor: '#1a1714',
    glyph,
    scale,
  }).element;
}

function clearMarkers(list) {
  list.forEach((m) => (m.map = null));
  list.length = 0;
}

/* O nome do evento mudou entre versões da API: ouvimos os dois, mas
   respondemos só uma vez por toque. */
function onMarkerClick(marker, handler) {
  let last = 0;
  const once = () => {
    const now = Date.now();
    if (now - last < 300) return;
    last = now;
    handler();
  };
  marker.addListener('gmp-click', once);
  marker.addListener('click', once);
}

/**
 * Desenha as paragens do dia ativo, numeradas por ordem.
 * `onClick(item)` é chamado quando se toca num pin.
 */
export function renderDayMarkers(items, onClick) {
  if (!map) return;
  clearMarkers(dayMarkers);
  items.forEach((it, i) => {
    if (!Number.isFinite(it.lat) || !Number.isFinite(it.lng)) return;
    const cat = CATEGORIES[it.category] || CATEGORIES.other;
    const marker = new libs.AdvancedMarkerElement({
      map,
      position: { lat: it.lat, lng: it.lng },
      content: pin(String(i + 1), cat.color, 1.15),
      title: it.name,
      zIndex: 100 + i,
      gmpClickable: true,
    });
    onMarkerClick(marker, () => {
      openInfo(marker, `<div class="iw"><b>${cat.emoji} ${escapeHtml(it.name)}</b>
        <small>${it.time ? it.time + ' · ' : ''}${escapeHtml(it.address || '')}</small></div>`);
      onClick?.(it);
    });
    dayMarkers.push(marker);
  });
}

/** Pins claros para os resultados de pesquisa. */
export function renderSearchMarkers(places, onClick) {
  if (!map) return;
  clearMarkers(searchMarkers);
  places.forEach((p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    const cat = CATEGORIES[p.category] || CATEGORIES.other;
    const marker = new libs.AdvancedMarkerElement({
      map,
      position: { lat: p.lat, lng: p.lng },
      content: pin(cat.emoji, '#2a2420', 0.9),
      title: p.name,
      zIndex: 10,
      gmpClickable: true,
    });
    onMarkerClick(marker, () => {
      openInfo(marker, `<div class="iw"><b>${escapeHtml(p.name)}</b>
        <small>${p.rating ? '★ ' + p.rating + ' · ' : ''}${escapeHtml(p.address || '')}</small></div>`);
      onClick?.(p);
    });
    searchMarkers.push(marker);
  });
}

export function clearSearchMarkers() {
  if (map) clearMarkers(searchMarkers);
}

function openInfo(marker, html) {
  infoWindow.setContent(html);
  infoWindow.open({ map, anchor: marker });
}

export function focusOn(lat, lng, zoom = 17) {
  if (!map || !Number.isFinite(lat)) return;
  map.panTo({ lat, lng });
  if (map.getZoom() < zoom) map.setZoom(zoom);
  if (map3d && !map3d.hidden) {
    map3d.center = { lat, lng, altitude: 120 };
    map3d.range = 900;
  }
}

export function fitToItems(items) {
  if (!map) return;
  const pts = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  if (!pts.length) return;
  if (pts.length === 1) { focusOn(pts[0].lat, pts[0].lng, 16); return; }
  const b = new google.maps.LatLngBounds();
  pts.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
  map.fitBounds(b, { top: 70, right: 70, bottom: 90, left: 70 });
}

/** Limites do que está à vista — para pesquisar "só nesta zona". */
export function visibleBounds() {
  if (!map) return null;
  const b = map.getBounds();
  if (!b) return null;
  const c = map.getCenter();
  const ne = b.getNorthEast();
  return {
    center: { lat: c.lat(), lng: c.lng() },
    radius: Math.min(
      google.maps.geometry?.spherical?.computeDistanceBetween(c, ne) || 3000,
      30000,
    ),
  };
}

/* ---------- trajeto ---------- */

export function clearRoute() {
  if (!dirRenderer) return;
  dirRenderer.setMap(null);
  dirRenderer.setMap(map);
  route3dLine?.remove?.();
  route3dLine = null;
}

/**
 * Calcula e desenha o trajeto entre as paragens do dia.
 * Devolve { totalMin, totalKm, legs:[{min,km,text}] } ou null.
 */
export async function drawRoute(items, mode = 'WALKING', departAt = null) {
  if (!map) return null;
  const pts = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  if (pts.length < 2) { clearRoute(); return null; }

  const capped = pts.slice(0, 25);
  const request = {
    origin: { lat: capped[0].lat, lng: capped[0].lng },
    destination: { lat: capped.at(-1).lat, lng: capped.at(-1).lng },
    waypoints: capped.slice(1, -1).map((p) => ({ location: { lat: p.lat, lng: p.lng }, stopover: true })),
    travelMode: mode,
    optimizeWaypoints: false,
    language: 'pt-PT',
    region: 'IT',
  };
  if (mode === 'TRANSIT' && departAt) request.transitOptions = { departureTime: departAt };

  try {
    const res = await dirService.route(request);
    dirRenderer.setDirections(res);
    const legs = res.routes[0].legs.map((l) => ({
      min: Math.round(l.duration.value / 60),
      km: l.distance.value / 1000,
      text: `${l.duration.text} · ${l.distance.text}`,
    }));
    if (map3d && !map3d.hidden) drawRoute3d(capped);
    return {
      legs,
      totalMin: legs.reduce((s, l) => s + l.min, 0),
      totalKm: legs.reduce((s, l) => s + l.km, 0),
      overview: res.routes[0].overview_path,
    };
  } catch (e) {
    console.warn('Directions falhou:', e?.message || e);
    return null;
  }
}

/**
 * Reordena as paragens intermédias para minimizar o percurso.
 * Devolve a nova ordem (índices sobre o array recebido) ou null.
 */
export async function optimizeOrder(items, mode = 'WALKING') {
  const idx = items.map((it, i) => ({ it, i })).filter(({ it }) => Number.isFinite(it.lat));
  if (idx.length < 4) return null;
  try {
    const res = await dirService.route({
      origin: { lat: idx[0].it.lat, lng: idx[0].it.lng },
      destination: { lat: idx.at(-1).it.lat, lng: idx.at(-1).it.lng },
      waypoints: idx.slice(1, -1).map(({ it }) => ({ location: { lat: it.lat, lng: it.lng }, stopover: true })),
      travelMode: mode,
      optimizeWaypoints: true,
    });
    const order = res.routes[0].waypoint_order;              // índices sobre os intermédios
    const middle = idx.slice(1, -1);
    const newIdx = [idx[0], ...order.map((o) => middle[o]), idx.at(-1)].map((x) => x.i);
    // as paragens sem coordenadas ficam no fim, pela ordem original
    const rest = items.map((_, i) => i).filter((i) => !newIdx.includes(i));
    return [...newIdx, ...rest];
  } catch (e) {
    console.warn('Otimização falhou:', e?.message || e);
    return null;
  }
}

/* ---------- vistas 2D / 3D ---------- */

export function setTilt(on) {
  if (!map) return;
  map.setTilt(on ? 67.5 : 0);
  if (on && map.getZoom() < 17) map.setZoom(17);
}

export function rotate(delta) {
  if (!map) return;
  map.setHeading(((map.getHeading() || 0) + delta + 360) % 360);
  if (map3d && !map3d.hidden) map3d.heading = ((map3d.heading || 0) + delta + 360) % 360;
}

/** Testa se o mapa fotorrealista 3D está disponível nesta versão da API. */
export async function probe3dPhoto() {
  if (has3dPhoto !== null) return has3dPhoto;
  try {
    const lib = await google.maps.importLibrary('maps3d');
    libs.Map3DElement = lib.Map3DElement;
    libs.Marker3DElement = lib.Marker3DElement || lib.Marker3DInteractiveElement;
    libs.Polyline3DElement = lib.Polyline3DElement;
    libs.AltitudeMode = lib.AltitudeMode;
    libs.MapMode = lib.MapMode;
    has3dPhoto = !!lib.Map3DElement;
  } catch {
    has3dPhoto = false;
  }
  return has3dPhoto;
}

/** Cria (uma vez) e mostra o mapa fotorrealista. */
export async function show3dPhoto(host, items) {
  if (!(await probe3dPhoto())) return false;
  if (!map3d) {
    map3d = new libs.Map3DElement({
      center: { ...ROME.center, altitude: 80 },
      range: 2500,
      tilt: 65,
      heading: 20,
      ...(libs.MapMode ? { mode: libs.MapMode.HYBRID } : {}),
    });
    host.appendChild(map3d);
  }
  host.hidden = false;
  map3d.hidden = false;
  await render3dItems(items);
  return true;
}

export function hide3dPhoto(host) {
  if (host) host.hidden = true;
  if (map3d) map3d.hidden = true;
}

async function render3dItems(items) {
  if (!map3d) return;
  [...map3d.children].forEach((c) => c.remove());
  const pts = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  if (!pts.length) return;

  if (libs.Marker3DElement) {
    pts.forEach((it, i) => {
      const m = new libs.Marker3DElement({
        position: { lat: it.lat, lng: it.lng, altitude: 30 },
        label: `${i + 1}. ${it.name}`,
        ...(libs.AltitudeMode ? { altitudeMode: libs.AltitudeMode.RELATIVE_TO_GROUND } : {}),
        extruded: true,
      });
      map3d.append(m);
    });
  }
  drawRoute3d(pts);

  const c = pts[Math.floor(pts.length / 2)];
  map3d.center = { lat: c.lat, lng: c.lng, altitude: 60 };
  map3d.range = Math.max(1200, pts.length * 350);
}

function drawRoute3d(pts) {
  if (!map3d || !libs.Polyline3DElement || pts.length < 2) return;
  route3dLine?.remove?.();
  route3dLine = new libs.Polyline3DElement({
    coordinates: pts.map((p) => ({ lat: p.lat, lng: p.lng, altitude: 12 })),
    strokeColor: '#f2b134',
    strokeWidth: 9,
    ...(libs.AltitudeMode ? { altitudeMode: libs.AltitudeMode.RELATIVE_TO_GROUND } : {}),
  });
  map3d.append(route3dLine);
}

export function refresh3d(items) {
  if (map3d && !map3d.hidden) render3dItems(items);
}

/* ---------- auxiliar ---------- */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
