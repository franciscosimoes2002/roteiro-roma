/* ============================================================
   Atalhos para a app nativa do Google Maps.

   No telemóvel estes endereços abrem a aplicação instalada, que é o
   que serve para navegar a pé — e funciona com os mapas offline que
   ela tenha descarregado.
   ============================================================ */

const MODES = { WALKING: 'walking', TRANSIT: 'transit', DRIVING: 'driving', BICYCLING: 'bicycling' };

const hasCoords = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
const ll = (p) => `${p.lat},${p.lng}`;

/** Link para uma paragem. Usa coordenadas se houver; senão, o nome. */
export function placeLink(it) {
  if (!it) return null;
  if (hasCoords(it)) {
    return `https://www.google.com/maps/search/?api=1&query=${ll(it)}`
      + (it.placeId ? `&query_place_id=${encodeURIComponent(it.placeId)}` : '');
  }
  // sem coordenadas, só vale a pena se houver nome ou morada — senão
  // estaríamos a mandar a pessoa para "Roma" e mais nada
  if (!it.name && !it.address) return null;
  const text = [it.name, it.address, 'Roma'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

/**
 * Link com o percurso do dia inteiro.
 * A Google aceita no máximo 9 pontos intermédios neste formato — os
 * que passarem disso ficam de fora, e por isso devolvemos `skipped`.
 */
export function dayRouteLink(items, mode = 'WALKING') {
  const pts = (items || []).filter(hasCoords);
  if (pts.length < 2) return null;

  const middle = pts.slice(1, -1);
  const used = middle.slice(0, 9);
  const params = new URLSearchParams({
    api: '1',
    origin: ll(pts[0]),
    destination: ll(pts.at(-1)),
    travelmode: MODES[mode] || 'walking',
  });
  if (used.length) params.set('waypoints', used.map(ll).join('|'));

  return {
    url: `https://www.google.com/maps/dir/?${params}`,
    stops: used.length + 2,
    skipped: middle.length - used.length,
  };
}
