/* ============================================================
   Constantes, categorias e dados de base sobre Roma.
   ============================================================ */

export const ROME = {
  center: { lat: 41.8933, lng: 12.4829 },
  bounds: { north: 41.99, south: 41.80, east: 12.62, west: 12.36 },
  defaultZoom: 14,
};

export const CURRENCY_DEFAULT = '€';

/* Categorias das paragens. `group` controla a cor do pin e o cálculo de custos. */
export const CATEGORIES = {
  sight:     { label: 'Monumento / Passeio', emoji: '🏛️', group: 'sight',     color: '#e0733c', defaultMin: 90 },
  museum:    { label: 'Museu',               emoji: '🖼️', group: 'sight',     color: '#c9592f', defaultMin: 150 },
  church:    { label: 'Igreja / Basílica',   emoji: '⛪',  group: 'sight',     color: '#b5713f', defaultMin: 45 },
  viewpoint: { label: 'Miradouro',           emoji: '🌇',  group: 'sight',     color: '#d98c3a', defaultMin: 40 },
  park:      { label: 'Parque / Jardim',     emoji: '🌳',  group: 'sight',     color: '#4fa87a', defaultMin: 60 },
  food:      { label: 'Restaurante',         emoji: '🍝',  group: 'food',      color: '#f2b134', defaultMin: 90 },
  cafe:      { label: 'Café / Pastelaria',   emoji: '☕',  group: 'food',      color: '#e8c06a', defaultMin: 30 },
  gelato:    { label: 'Gelataria',           emoji: '🍨',  group: 'food',      color: '#efd4a1', defaultMin: 20 },
  bar:       { label: 'Bar / Aperitivo',     emoji: '🍸',  group: 'food',      color: '#d8a15a', defaultMin: 60 },
  shopping:  { label: 'Compras / Mercado',   emoji: '🛍️', group: 'other',     color: '#a58b7a', defaultMin: 60 },
  hotel:     { label: 'Alojamento',          emoji: '🛏️', group: 'hotel',     color: '#5b93d6', defaultMin: 0 },
  transport: { label: 'Transporte / Voo',    emoji: '✈️',  group: 'transport', color: '#7d6f63', defaultMin: 0 },
  other:     { label: 'Outro',               emoji: '📍',  group: 'other',     color: '#8a7d71', defaultMin: 60 },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

/* Mapeamento dos tipos da Google Places -> categoria interna. */
const TYPE_MAP = {
  restaurant: 'food', italian_restaurant: 'food', pizza_restaurant: 'food',
  meal_takeaway: 'food', fine_dining_restaurant: 'food', food: 'food',
  cafe: 'cafe', coffee_shop: 'cafe', bakery: 'cafe',
  ice_cream_shop: 'gelato', dessert_shop: 'gelato',
  bar: 'bar', wine_bar: 'bar', pub: 'bar', night_club: 'bar',
  museum: 'museum', art_gallery: 'museum',
  church: 'church', place_of_worship: 'church', synagogue: 'church', mosque: 'church',
  park: 'park', garden: 'park', national_park: 'park',
  tourist_attraction: 'sight', historical_landmark: 'sight', monument: 'sight',
  historical_place: 'sight', archaeological_site: 'sight', cultural_landmark: 'sight',
  observation_deck: 'viewpoint', scenic_point: 'viewpoint',
  shopping_mall: 'shopping', market: 'shopping', store: 'shopping', clothing_store: 'shopping',
  lodging: 'hotel', hotel: 'hotel', bed_and_breakfast: 'hotel', guest_house: 'hotel',
  subway_station: 'transport', train_station: 'transport', airport: 'transport',
  bus_station: 'transport', transit_station: 'transport',
};

export function categoryFromTypes(types = []) {
  for (const t of types) if (TYPE_MAP[t]) return TYPE_MAP[t];
  return 'other';
}

/* Guia de bilhetes: o que vale mesmo a pena reservar antes de ir. */
export const TICKET_GUIDE = [
  {
    name: 'Coliseu + Fórum Romano + Palatino',
    when: 'Reservar 3–4 semanas antes',
    desc: 'O bilhete comum dá entrada nos três com hora marcada para o Coliseu. A Arena e os Subterrâneos esgotam quase de imediato e só saem em datas certas.',
    url: 'https://www.coopculture.it/en/colosseo-e-shop.cfm',
    price: '18–24 €',
  },
  {
    name: 'Museus do Vaticano + Capela Sistina',
    when: 'Reservar 1–2 meses antes',
    desc: 'Compra sempre no site oficial com hora marcada — poupa 1–2 h de fila. Vai cedo (8h00) ou já ao fim da tarde. Fecha aos domingos, exceto no último domingo do mês (entrada grátis, muita gente).',
    url: 'https://tickets.museivaticani.va/',
    price: '20–27 €',
  },
  {
    name: 'Basílica de São Pedro + Cúpula',
    when: 'Entrada grátis; subir à cúpula paga-se à porta',
    desc: 'A basílica é gratuita mas a fila da segurança é longa: chega antes das 8h. A cúpula (551 degraus ou elevador até meio) vale muito a pena. Ombros e joelhos tapados.',
    url: 'https://www.vatican.va/various/basiliche/san_pietro/index_it.htm',
    price: '0 € / 8–10 €',
  },
  {
    name: 'Galleria Borghese',
    when: 'Reservar 3–4 semanas antes — obrigatório',
    desc: 'Entradas por turnos de 2 horas, número limitado de pessoas. Só se entra com reserva. Um dos museus mais bonitos de Roma e fica no parque.',
    url: 'https://galleriaborghese.beniculturali.it/en/',
    price: '13–20 €',
  },
  {
    name: 'Panteão',
    when: 'Bilhete online recomendado',
    desc: 'Deixou de ser gratuito. Bilhete com hora marcada evita a fila na praça. Gratuito para residentes da UE em certos dias.',
    url: 'https://www.pantheonroma.com/',
    price: '5 €',
  },
  {
    name: 'Castel Sant\'Angelo',
    when: 'Online 1 semana antes',
    desc: 'O terraço tem a melhor vista sobre São Pedro, sobretudo ao pôr do sol. Costuma ter fila curta ao início da manhã.',
    url: 'https://castelsantangelo.cultura.gov.it/',
    price: '16 €',
  },
  {
    name: 'Escavações da Basílica de São Clemente',
    when: 'Reservar com antecedência',
    desc: 'Três igrejas empilhadas, uma por cima da outra, com 2000 anos de história. Menos conhecida e muito melhor do que parece.',
    url: 'https://basilicasanclemente.com/',
    price: '10 €',
  },
  {
    name: 'Villa Farnesina / Palazzo Doria Pamphilj',
    when: 'À porta chega',
    desc: 'Duas alternativas pouco cheias para um dia em que os grandes museus estejam impossíveis.',
    url: 'https://www.doriapamphilj.it/roma/',
    price: '10–16 €',
  },
  {
    name: 'Comboio para Florença / Nápoles (bate-volta)',
    when: 'Quanto mais cedo, mais barato',
    desc: 'Trenitalia e Italo: os preços sobem à medida que a data se aproxima. Nápoles fica a 1h10 e Florença a 1h30 de Roma Termini.',
    url: 'https://www.trenitalia.com/',
    price: '20–60 €',
  },
  {
    name: 'Restaurantes concorridos',
    when: '1–3 semanas antes',
    desc: 'Roscioli, Armando al Pantheon, Felice a Testaccio, Da Enzo al 29 e Pierluigi enchem-se depressa. Para um jantar especial, reserva mal tenhas as datas.',
    url: 'https://www.thefork.pt/',
    price: '—',
  },
];

/* Pontos de referência para arrancar sem a API do Google. */
export const ROME_SEED = [
  { name: 'Coliseu', category: 'sight', lat: 41.8902, lng: 12.4922, address: 'Piazza del Colosseo, 1' },
  { name: 'Fórum Romano', category: 'sight', lat: 41.8925, lng: 12.4853, address: 'Via della Salara Vecchia, 5/6' },
  { name: 'Panteão', category: 'sight', lat: 41.8986, lng: 12.4769, address: 'Piazza della Rotonda' },
  { name: 'Fontana di Trevi', category: 'sight', lat: 41.9009, lng: 12.4833, address: 'Piazza di Trevi' },
  { name: 'Praça de Espanha', category: 'sight', lat: 41.9058, lng: 12.4823, address: 'Piazza di Spagna' },
  { name: 'Piazza Navona', category: 'sight', lat: 41.8992, lng: 12.4731, address: 'Piazza Navona' },
  { name: 'Basílica de São Pedro', category: 'church', lat: 41.9022, lng: 12.4539, address: 'Piazza San Pietro, Vaticano' },
  { name: 'Museus do Vaticano', category: 'museum', lat: 41.9065, lng: 12.4536, address: 'Viale Vaticano' },
  { name: 'Castel Sant\'Angelo', category: 'sight', lat: 41.9031, lng: 12.4663, address: 'Lungotevere Castello, 50' },
  { name: 'Trastevere', category: 'sight', lat: 41.8896, lng: 12.4695, address: 'Trastevere' },
  { name: 'Galleria Borghese', category: 'museum', lat: 41.9142, lng: 12.4922, address: 'Piazzale Scipione Borghese, 5' },
  { name: 'Jardim das Laranjeiras (Giardino degli Aranci)', category: 'viewpoint', lat: 41.8843, lng: 12.4793, address: 'Piazza Pietro D\'Illiria' },
  { name: 'Campo de\' Fiori', category: 'shopping', lat: 41.8956, lng: 12.4722, address: 'Piazza Campo de\' Fiori' },
  { name: 'Bairro Judeu (Ghetto)', category: 'sight', lat: 41.8925, lng: 12.4780, address: 'Via del Portico d\'Ottavia' },
  { name: 'Villa Borghese', category: 'park', lat: 41.9139, lng: 12.4853, address: 'Villa Borghese' },
  { name: 'Terraço do Pincio', category: 'viewpoint', lat: 41.9110, lng: 12.4780, address: 'Piazzale Napoleone I' },
];

/* Velocidade média a pé em Roma, em km/h — usada quando não há Directions API. */
export const WALK_KMH = 4.4;

export const AI_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];
