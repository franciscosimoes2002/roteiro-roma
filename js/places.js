/* ============================================================
   Pesquisa de sítios em Roma (Places API) + meteorologia.
   ============================================================ */

import { ROME, categoryFromTypes } from './config.js';

const SEARCH_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating',
  'userRatingCount', 'priceLevel', 'photos', 'types', 'businessStatus',
];

const DETAIL_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
  'priceLevel', 'photos', 'types', 'regularOpeningHours', 'websiteURI',
  'nationalPhoneNumber', 'editorialSummary', 'googleMapsURI', 'reviews',
];

const PRICE_LABEL = {
  FREE: 'grátis', INEXPENSIVE: '€', MODERATE: '€€', EXPENSIVE: '€€€', VERY_EXPENSIVE: '€€€€',
};

let PlaceCls = null;

async function places() {
  if (!PlaceCls) {
    const lib = await google.maps.importLibrary('places');
    PlaceCls = lib.Place;
    if (!PlaceCls) throw new Error('A Places API (New) não está ativa nesta chave.');
  }
  return PlaceCls;
}

/** Converte um objeto Place da Google para o formato interno da app. */
export function normalize(p) {
  const loc = p.location;
  return {
    placeId: p.id,
    name: p.displayName || 'Sem nome',
    address: (p.formattedAddress || '').replace(/, Itália$/i, '').replace(/, Italy$/i, ''),
    lat: typeof loc?.lat === 'function' ? loc.lat() : loc?.lat ?? null,
    lng: typeof loc?.lng === 'function' ? loc.lng() : loc?.lng ?? null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    price: PRICE_LABEL[p.priceLevel] || null,
    category: categoryFromTypes(p.types || []),
    types: p.types || [],
    photo: p.photos?.[0] ? p.photos[0].getURI({ maxWidth: 400, maxHeight: 400 }) : null,
    closed: p.businessStatus && p.businessStatus !== 'OPERATIONAL',
    _raw: p,
  };
}

/**
 * Pesquisa por texto, sempre centrada em Roma.
 * `area` (opcional) = { center:{lat,lng}, radius } para limitar à zona visível.
 */
export async function searchText(query, area = null, max = 18) {
  const Place = await places();
  const req = {
    textQuery: /roma|rome|vatican/i.test(query) ? query : `${query} em Roma, Itália`,
    fields: SEARCH_FIELDS,
    language: 'pt-PT',
    region: 'it',
    maxResultCount: max,
    locationBias: area
      ? { center: area.center, radius: Math.min(area.radius, 20000) }
      : { center: ROME.center, radius: 6000 },
  };
  const { places: found } = await Place.searchByText(req);
  return (found || []).map(normalize);
}

/** Pesquisa por tipo à volta de um ponto (mais preciso para "restaurantes aqui perto"). */
export async function searchNearby(includedType, area, max = 18) {
  const Place = await places();
  const { places: found } = await Place.searchNearby({
    fields: SEARCH_FIELDS,
    locationRestriction: {
      center: area?.center || ROME.center,
      radius: Math.min(area?.radius || 1800, 45000),
    },
    includedPrimaryTypes: [includedType],
    maxResultCount: max,
    rankPreference: 'POPULARITY',
    language: 'pt-PT',
    region: 'it',
  });
  return (found || []).map(normalize);
}

/**
 * Resolve um nome em coordenadas — usado quando a IA sugere sítios.
 * Devolve o melhor resultado ou null.
 */
export async function resolveOne(query) {
  try {
    const res = await searchText(query, null, 1);
    return res[0] || null;
  } catch (e) {
    console.warn('Não resolvi:', query, e?.message);
    return null;
  }
}

/** Detalhes completos de um sítio (horários, site, telefone, críticas). */
export async function details(placeId) {
  const Place = await places();
  const p = new Place({ id: placeId, requestedLanguage: 'pt-PT' });
  await p.fetchFields({ fields: DETAIL_FIELDS });
  const base = normalize(p);
  return {
    ...base,
    website: p.websiteURI || null,
    phone: p.nationalPhoneNumber || null,
    summary: p.editorialSummary || null,
    mapsUrl: p.googleMapsURI || null,
    hours: p.regularOpeningHours?.weekdayDescriptions || null,
    openNow: p.regularOpeningHours?.openNow ?? null,
    topReview: p.reviews?.[0]
      ? { text: p.reviews[0].text, author: p.reviews[0].authorAttribution?.displayName, rating: p.reviews[0].rating }
      : null,
    photos: (p.photos || []).slice(0, 5).map((ph) => ph.getURI({ maxWidth: 800 })),
  };
}

/* ---------- meteorologia (Open-Meteo, sem chave) ---------- */

const wxCache = new Map();

const WX_ICON = (code) => {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
};

/**
 * Previsão para Roma entre duas datas (máx. 16 dias à frente).
 * Devolve { '2026-04-12': { icon, min, max, rain } , … }
 */
export async function forecast(startISO, endISO) {
  const key = `${startISO}|${endISO}`;
  if (wxCache.has(key)) return wxCache.get(key);
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${ROME.center.lat}&longitude=${ROME.center.lng}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + `&timezone=Europe%2FRome&start_date=${startISO}&end_date=${endISO}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('meteo indisponível');
    const j = await r.json();
    const out = {};
    (j.daily?.time || []).forEach((d, i) => {
      out[d] = {
        icon: WX_ICON(j.daily.weather_code[i]),
        min: Math.round(j.daily.temperature_2m_min[i]),
        max: Math.round(j.daily.temperature_2m_max[i]),
        rain: j.daily.precipitation_probability_max[i],
      };
    });
    wxCache.set(key, out);
    return out;
  } catch {
    return {};
  }
}
