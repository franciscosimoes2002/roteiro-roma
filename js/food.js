/* ============================================================
   Checklist de comida — Roma.

   who:  'both' = para os dois · 'her' = só para ela
   tag:  'cheese' = leva queijo · 'fish' = peixe/marisco
   place: sítio concreto onde se come melhor (abre a pesquisa lá)
   ============================================================ */

export const FOOD_LEGEND = [
  { icon: '🧀', text: 'leva queijo, só para ela' },
  { icon: '🌿', text: 'sem queijo, para os dois' },
  { icon: '🐟', text: 'peixe, o Francisco passa' },
];

export const FOOD_PHRASE = {
  it: 'Senza formaggio, per favore',
  note: 'Dita ao pedir, nunca quando o prato chega.',
};

export const FOOD_AVOID = [
  'Fettuccine Alfredo',
  'Esparguete à bolonhesa',
  'Pizza com ananás',
  'Qualquer coisa anunciada como “autêntico” em cinco línguas',
  'Cappuccino depois do almoço',
];

/* Lista curada: o que o Francisco pode pedir sem pensar. */
export const FOOD_QUICK = [
  'pizza marinara', 'arrabbiata', 'aglio e olio', 'amatriciana sem pecorino',
  'pasta e ceci', 'ragù bolognese', 'puttanesca', 'carciofi alla giudia',
  'abbacchio', 'saltimbocca', 'pollo alla romana', 'porchetta', 'bistecca',
  'ossobuco', 'cotoletta', 'vitello tonnato', 'bruschetta', 'prosciutto e melone',
  'pizza bianca', 'trapizzino', 'maritozzo', 'panna cotta', 'sfogliatella',
  'affogato', 'granita', 'gelato',
];

export const FOOD = [
  {
    id: 'romanas',
    title: 'Romanas',
    badge: 'prioridade máxima',
    intro: 'Estas são de Roma. É aqui que se comem melhor do que em qualquer outro sítio do mundo.',
    groups: [
      {
        title: 'Imperdíveis',
        star: true,
        dishes: [
          { id: 'cacio-e-pepe', name: 'Cacio e pepe', desc: 'Pecorino, pimenta e água da massa. A mais romana de todas.', who: 'her', tag: 'cheese' },
          { id: 'carbonara', name: 'Carbonara', desc: 'Ovo, guanciale, pecorino. Nunca natas.', who: 'her', tag: 'cheese' },
          { id: 'pizza-marinara', name: 'Pizza romana marinara', desc: 'Fina e estaladiça. Tomate, alho, orégãos.', who: 'both' },
          { id: 'carciofi-giudia', name: 'Carciofi alla giudia', desc: 'Alcachofra frita inteira, do Gueto.', who: 'both', place: 'Nonna Betta, Roma' },
          { id: 'maritozzo', name: 'Maritozzo', desc: 'Brioche com nata batida, ao pequeno-almoço.', who: 'both' },
          { id: 'suppli', name: 'Supplì', desc: 'Croquete de arroz com mozarela que estica.', who: 'her', tag: 'cheese' },
          { id: 'gelato', name: 'Gelato', desc: 'Todos os dias.', who: 'both' },
        ],
      },
      {
        title: 'Massas',
        dishes: [
          { id: 'amatriciana', name: 'Amatriciana', desc: 'Guanciale e tomate. Pedir senza pecorino.', who: 'both' },
          { id: 'gricia', name: 'Gricia', desc: 'A carbonara sem ovo.', who: 'her', tag: 'cheese' },
          { id: 'arrabbiata', name: "All'arrabbiata", desc: 'Tomate, alho, malagueta.', who: 'both' },
          { id: 'aglio-olio', name: 'Aglio, olio e peperoncino', desc: '', who: 'both' },
          { id: 'pasta-ceci', name: 'Pasta e ceci', desc: 'Grão com massa.', who: 'both' },
        ],
      },
      {
        title: 'Carne',
        dishes: [
          { id: 'abbacchio', name: 'Abbacchio scottadito', desc: 'Costeletas de borrego, comem-se com as mãos.', who: 'both' },
          { id: 'saltimbocca', name: 'Saltimbocca alla romana', desc: 'Vitela, presunto e salva.', who: 'both' },
          { id: 'pollo-romana', name: 'Pollo alla romana', desc: 'Frango com pimentos.', who: 'both' },
          { id: 'porchetta', name: 'Porchetta', desc: 'Leitão assado com ervas.', who: 'both' },
        ],
      },
      {
        title: 'Rua e balcão',
        dishes: [
          { id: 'pizza-taglio', name: 'Pizza al taglio', desc: 'Ao peso, na Pizzarium Bonci.', who: 'both', place: 'Pizzarium Bonci, Roma' },
          { id: 'pizza-bianca', name: 'Pizza bianca', desc: "Azeite e sal grosso, do Forno Campo de' Fiori.", who: 'both', place: "Forno Campo de' Fiori, Roma" },
          { id: 'trapizzino', name: 'Trapizzino', desc: 'Cone de pizza com guisado. O de pollo alla cacciatora.', who: 'both', place: 'Trapizzino, Roma' },
          { id: 'fiori-zucca', name: 'Fiori di zucca', desc: 'Flores de abóbora fritas.', who: 'her', tag: 'cheese' },
          { id: 'baccala', name: 'Filetti di baccalà', desc: 'Bacalhau frito.', who: 'her', tag: 'fish', place: 'Dar Filettaro a Santa Barbara, Roma' },
        ],
      },
      {
        title: 'Para quem se atreve',
        dishes: [
          { id: 'trippa', name: 'Trippa alla romana', desc: 'Dobrada com tomate e hortelã.', who: 'her', tag: 'cheese' },
          { id: 'coda-vaccinara', name: 'Coda alla vaccinara', desc: 'Rabo de boi estufado com aipo e cacau.', who: 'both' },
        ],
      },
      {
        title: 'Café',
        dishes: [
          { id: 'caffe-balcao', name: 'Caffè ao balcão', desc: '1,20 €, três minutos, em pé.', who: 'both' },
          { id: 'cornetto', name: 'Cornetto', desc: 'Ao pequeno-almoço.', who: 'both' },
        ],
      },
    ],
  },
  {
    id: 'italianas',
    title: 'Italianas',
    badge: 'de outras regiões',
    intro: 'Encontram tudo isto em Roma, mas em versão importada. Comam para variar, não como prioridade.',
    groups: [
      {
        title: 'Massas',
        dishes: [
          { id: 'ragu-bolognese', name: 'Tagliatelle al ragù alla bolognese', desc: 'De Bolonha. Nunca com esparguete.', who: 'both' },
          { id: 'pesto', name: 'Pesto alla genovese', desc: 'Manjericão, pinhões, parmesão.', who: 'her', tag: 'cheese' },
          { id: 'lasagne', name: 'Lasagne', desc: '', who: 'her', tag: 'cheese' },
          { id: 'puttanesca', name: 'Puttanesca', desc: 'Anchovas, azeitonas, alcaparras.', who: 'both' },
          { id: 'norma', name: 'Pasta alla norma', desc: 'Siciliana, com beringela.', who: 'her', tag: 'cheese' },
          { id: 'vongole', name: 'Spaghetti alle vongole', desc: 'Napolitana.', who: 'her', tag: 'fish' },
        ],
      },
      {
        title: 'Pizza e pão',
        dishes: [
          { id: 'pizza-napolitana', name: 'Pizza napolitana', desc: 'Bordo alto e fofo, o oposto da romana.', who: 'both' },
          { id: 'focaccia', name: 'Focaccia genovesa', desc: '', who: 'both' },
          { id: 'piadina', name: 'Piadina', desc: 'Pão fino da Romagna.', who: 'both' },
        ],
      },
      {
        title: 'Pratos principais',
        dishes: [
          { id: 'ossobuco', name: 'Ossobuco alla milanese', desc: 'Chambão de vitela estufado.', who: 'both' },
          { id: 'bistecca', name: 'Bistecca alla fiorentina', desc: 'Vende-se ao peso, vem mal passado.', who: 'both' },
          { id: 'cotoletta', name: 'Cotoletta alla milanese', desc: 'Vitela panada com osso.', who: 'both' },
          { id: 'vitello-tonnato', name: 'Vitello tonnato', desc: 'Vitela fria com molho de atum.', who: 'both' },
          { id: 'risotto-milanese', name: 'Risotto alla milanese', desc: 'Arroz de açafrão.', who: 'her', tag: 'cheese' },
        ],
      },
      {
        title: 'Antipasti',
        dishes: [
          { id: 'bruschetta', name: 'Bruschetta', desc: 'Pão torrado com tomate e alho.', who: 'both' },
          { id: 'prosciutto-melone', name: 'Prosciutto e melone', desc: '', who: 'both' },
          { id: 'affettati', name: 'Affettati misti', desc: 'Tábua de enchidos.', who: 'both' },
          { id: 'caprese', name: 'Caprese', desc: 'Tomate, mozarela, manjericão.', who: 'her', tag: 'cheese' },
          { id: 'arancini', name: 'Arancini', desc: 'Sicilianos, primos dos supplì.', who: 'her', tag: 'cheese' },
        ],
      },
      {
        title: 'Doces',
        dishes: [
          { id: 'affogato', name: 'Affogato', desc: 'Gelado de baunilha com café por cima.', who: 'both' },
          { id: 'panna-cotta', name: 'Panna cotta', desc: '', who: 'both' },
          { id: 'sfogliatella', name: 'Sfogliatella', desc: 'Napolitana, folhada e estaladiça.', who: 'both' },
          { id: 'granita', name: 'Granita siciliana', desc: '', who: 'both' },
          { id: 'tiramisu', name: 'Tiramisù', desc: "No Two Sizes, Via del Governo Vecchio, junto à Piazza Navona.", who: 'her', tag: 'cheese', place: 'Two Sizes Tiramisù, Roma' },
          { id: 'cannoli', name: 'Cannoli siciliani', desc: '', who: 'her', tag: 'cheese' },
        ],
      },
    ],
  },
];

/* ---------- auxiliares ---------- */

export function allDishes() {
  return FOOD.flatMap((sec) => sec.groups.flatMap((g) =>
    g.dishes.map((d) => ({ ...d, section: sec.id, group: g.title }))));
}

export const dishIcon = (d) => (d.tag === 'cheese' ? '🧀' : d.tag === 'fish' ? '🐟' : '🌿');

/** Termo a procurar no mapa: o sítio concreto, se houver, senão o prato. */
export const dishSearch = (d) => d.place || `${d.name} Roma`;
