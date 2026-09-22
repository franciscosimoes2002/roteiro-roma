/* ============================================================
   Assistente de IA — conversa + alterações ao roteiro.

   Funciona com dois fornecedores, à escolha nas definições:
     · OpenAI     (api.openai.com, chamada direta por fetch)
     · Anthropic  (SDK oficial carregado do CDN)

   A chave fica no navegador e a chamada é feita a partir da página.
   Isso só é aceitável em uso pessoal e local.
   ============================================================ */

import { CATEGORY_KEYS, CATEGORIES } from './config.js';
import { allDishes } from './food.js';
import { state, days, dayDate, dayCost, isEaten } from './store.js';

/* ============================================================
   Esquema das respostas
   ============================================================ */

const OPS = [
  'add_place',    // acrescenta uma paragem (usa `query` para a encontrar no mapa)
  'remove_item',  // remove a paragem nº `item_index` do dia `day`
  'move_item',    // passa a paragem para `to_day` / `to_index`
  'update_item',  // muda hora, duração, custo, nome ou nota
  'reorder_day',  // nova ordem das paragens do dia
  'set_day_note', // nota do dia
  'clear_day',    // esvazia o dia
  'add_day',      // acrescenta um dia à viagem
];

/*
 * Os dois fornecedores exigem que TODOS os campos estejam em `required`,
 * por isso os opcionais são declarados como "isto ou null". A forma de
 * escrever isso difere: a OpenAI quer o tipo em lista, a Anthropic quer anyOf.
 */
function buildSchema(style) {
  const nul = style === 'openai'
    ? (s) => ({ ...s, type: Array.isArray(s.type) ? s.type : [s.type, 'null'] })
    : (s) => ({ anyOf: [s, { type: 'null' }] });

  const action = {
    type: 'object',
    additionalProperties: false,
    required: ['op', 'day', 'query', 'name', 'category', 'time', 'duration_min',
      'cost', 'note', 'item_index', 'to_day', 'to_index', 'order', 'why'],
    properties: {
      op: { type: 'string', enum: OPS },
      day: nul({ type: 'integer', description: 'Número do dia, a começar em 1.' }),
      query: nul({ type: 'string', description: 'Nome exato e pesquisável do sítio, com a cidade. Ex.: "Trattoria Da Enzo al 29, Roma".' }),
      name: nul({ type: 'string', description: 'Nome a mostrar no roteiro.' }),
      category: nul({ type: 'string', enum: CATEGORY_KEYS }),
      time: nul({ type: 'string', description: 'Hora de início, formato HH:MM.' }),
      duration_min: nul({ type: 'integer', description: 'Duração prevista em minutos.' }),
      cost: nul({ type: 'number', description: 'Custo total para o grupo, na moeda da viagem.' }),
      note: nul({ type: 'string', description: 'Nota curta e útil: o que ver, o que pedir, dica de fila.' }),
      item_index: nul({ type: 'integer', description: 'Posição da paragem dentro do dia, a começar em 1.' }),
      to_day: nul({ type: 'integer' }),
      to_index: nul({ type: 'integer' }),
      order: nul({ type: 'array', items: { type: 'integer' }, description: 'Nova ordem das paragens, com os números atuais.' }),
      why: nul({ type: 'string', description: 'Uma frase a explicar a alteração.' }),
    },
  };

  return {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'actions'],
    properties: {
      reply: { type: 'string', description: 'Resposta em português de Portugal, direta e concreta. Markdown simples.' },
      actions: { type: 'array', items: action, description: 'Alterações ao roteiro. Vazio se for só conversa.' },
    },
  };
}

/* ============================================================
   Contexto e instruções
   ============================================================ */

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const weekday = (iso) => (iso ? WEEKDAYS[new Date(iso + 'T12:00:00').getDay()] : '');

/** Descreve o roteiro atual de forma compacta para o modelo. */
export function buildContext() {
  const s = state.settings;
  const lines = [];

  lines.push(`Viagem: "${state.trip.name}" · ${state.trip.days.length} dias · ${s.travelers} viajantes · moeda ${s.currency}`);
  if (state.trip.start) lines.push(`Início: ${state.trip.start} (${weekday(state.trip.start)})`);
  if (s.home) lines.push(`Base/alojamento: ${s.home}`);
  if (s.prefs) lines.push(`Preferências do casal: ${s.prefs}`);
  lines.push(`Dia atualmente selecionado na app: dia ${state.ui.activeDay + 1}`);
  lines.push('');
  lines.push('ROTEIRO ATUAL');

  days().forEach((day, di) => {
    const date = dayDate(di);
    lines.push(`Dia ${di + 1} — ${date || 'sem data'} (${weekday(date)}) · ${day.items.length} paragens · ${dayCost(day)}${s.currency}`);
    if (day.note) lines.push(`  nota do dia: ${day.note}`);
    if (!day.items.length) lines.push('  (vazio)');
    day.items.forEach((it, i) => {
      const bits = [
        it.time || '--:--',
        `${it.duration || 0}min`,
        it.cost ? `${it.cost}${s.currency}` : null,
        CATEGORIES[it.category]?.label,
      ].filter(Boolean).join(', ');
      lines.push(`  ${i + 1}. ${it.name} [${bits}]${it.address ? ' @ ' + it.address : ''}`
        + `${it.ref ? ' · reserva ' + it.ref : ''}${it.notes ? ' · ' + it.notes.replace(/\n/g, ' ') : ''}`);
    });
  });

  if (state.saved.length) {
    lines.push('');
    lines.push('GUARDADOS (ainda fora do roteiro): ' + state.saved.map((p) => p.name).join('; '));
  }

  // Checklist de comida: interessa sobretudo o que ainda falta provar.
  const dishes = allDishes();
  const todo = dishes.filter((d) => !isEaten(d.id));
  if (todo.length) {
    const both = todo.filter((d) => d.who === 'both').map((d) => d.name);
    const her = todo.filter((d) => d.who !== 'both').map((d) => d.name);
    lines.push('');
    lines.push(`CHECKLIST DE COMIDA — faltam ${todo.length} de ${dishes.length} pratos.`);
    lines.push('Um dos dois não come queijo nem peixe; o outro come tudo.');
    if (both.length) lines.push('Por provar, servem para os dois: ' + both.join('; '));
    if (her.length) lines.push('Por provar, com queijo ou peixe (só para ela): ' + her.join('; '));
    lines.push('Quando sugerires restaurantes, dá prioridade a casas onde se comam estes pratos, e diz qual da lista se risca em cada uma.');
  }

  return lines.join('\n');
}

const SYSTEM = `És um planeador de viagens especializado em Roma, a ajudar um casal a montar o roteiro dentro de uma aplicação de mapas.

Escreve sempre em português de Portugal, num tom natural e direto — nada de linguagem de brochura.

O que sabes fazer bem:
- Conheces Roma a sério: distâncias a pé reais entre bairros, quanto tempo se demora mesmo em cada sítio, onde estão as filas, o que é armadilha para turistas.
- Sabes que os Museus do Vaticano fecham aos domingos (exceto o último do mês), que a Galleria Borghese só entra com reserva por turnos, que o Coliseu precisa de hora marcada, e que muitos restaurantes bons fecham à segunda ou em agosto.
- Agrupas por zona: Vaticano/Prati num dia, Roma antiga (Coliseu/Fórum/Palatino) noutro, centro histórico (Panteão/Navona/Trevi) noutro, Trastevere e Testaccio ao fim do dia.

Regras ao montar o roteiro:
- Não enches os dias. Um dia bom em Roma tem 2 a 4 paragens grandes, mais refeições e uma pausa à tarde.
- Marcas sempre almoço e jantar com horas realistas para Itália (almoço 13:00–14:30, jantar a partir das 20:00).
- Contas com o tempo de deslocação a pé entre paragens. Se duas paragens seguidas ficam a mais de 30 minutos a pé, dizes.
- Dás custos aproximados por par (a app soma o orçamento).
- Nas notas escreves o que interessa mesmo: o que não perder lá dentro, que prato pedir, a que horas evitar a fila.

Como devolves alterações:
- Quando o pedido implica mexer no roteiro, devolves as alterações no campo "actions" — não descreves apenas o que farias.
- Em "add_place", o campo "query" tem de ser um nome que a Google Maps encontre à primeira: nome próprio do sítio + ", Roma". Nunca uses descrições vagas como "um restaurante simpático".
- Os números dos dias e das paragens começam em 1 e referem-se ao estado atual mostrado no contexto.
- Quando removes ou moves várias paragens do mesmo dia, refere-te sempre à numeração ORIGINAL (a aplicação trata da ordem correta).
- O campo "reply" resume o que fizeste e porquê, em poucas linhas. Não repitas a lista inteira de ações.
- Se for só uma pergunta, responde e deixa "actions" vazio.

Respondes SEMPRE com um único objeto JSON com as chaves "reply" e "actions". Sem texto antes nem depois.`;

/* ============================================================
   Ponto de entrada
   ============================================================ */

/**
 * Envia a conversa ao modelo e devolve { reply, actions }.
 * `history` = [{role:'user'|'assistant', content:string}, …]
 */
export async function ask(userText, history = [], onStatus = () => {}) {
  const s = state.settings;
  const provider = s.aiProvider || 'openai';

  const messages = [
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `${userText}\n\n---\nESTADO ATUAL DA APLICAÇÃO (não repitas isto na resposta):\n${buildContext()}`,
    },
  ];

  const raw = provider === 'anthropic'
    ? await askAnthropic(messages, onStatus)
    : await askOpenAI(messages, onStatus);

  const parsed = parseReply(raw);
  return {
    reply: parsed.reply || '',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

function parseReply(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { reply: text || 'Não percebi a resposta do modelo.', actions: [] };
    try { return JSON.parse(m[0]); } catch { return { reply: text, actions: [] }; }
  }
}

/* ============================================================
   OpenAI
   ============================================================ */

const OPENAI_BASE = 'https://api.openai.com/v1';
let autoModel = { key: null, id: null };

async function openaiFetch(path, key, body = null) {
  const res = await fetch(OPENAI_BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch((e) => { throw new Error(networkHint(e)); });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(openaiError(res.status, data)), { status: res.status, data });
  return data;
}

function openaiError(status, data) {
  const msg = data?.error?.message || `erro ${status}`;
  const code = data?.error?.code;
  if (status === 401) return 'Chave da OpenAI inválida. Confirma nas definições.';
  if (code === 'insufficient_quota') return 'A conta da OpenAI não tem créditos disponíveis.';
  if (status === 429) return 'Demasiados pedidos seguidos (ou sem créditos). Espera um pouco e tenta outra vez.';
  if (status === 404 || code === 'model_not_found') {
    return `O modelo escolhido não existe nesta conta. Abre as definições e carrega em "Carregar modelos".`;
  }
  return msg;
}

async function askOpenAI(messages, onStatus) {
  const s = state.settings;
  if (!s.openaiKey) throw new Error('Falta a chave da OpenAI (⚙ Definições).');

  // "automático": descobre o melhor modelo da conta e guarda-o só para esta sessão,
  // para não andar a consultar a lista a cada mensagem.
  let model = s.openaiModel;
  if (!model) {
    if (autoModel.key !== s.openaiKey) {
      onStatus('a escolher o modelo…');
      autoModel = { key: s.openaiKey, id: await pickBestOpenAIModel(s.openaiKey) };
    }
    model = autoModel.id;
  }

  const body = {
    model,
    messages: [{ role: 'system', content: SYSTEM }, ...messages],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'plano_roteiro', strict: true, schema: buildSchema('openai') },
    },
  };

  onStatus('a pensar…');

  let data;
  try {
    data = await openaiFetch('/chat/completions', s.openaiKey, body);
  } catch (e) {
    // modelos mais antigos não aceitam json_schema — tentamos o modo JSON simples
    if (e.status === 400 && /response_format|json_schema|schema/i.test(e.message)) {
      onStatus('a repetir em modo simples…');
      data = await openaiFetch('/chat/completions', s.openaiKey, {
        model,
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        response_format: { type: 'json_object' },
      });
    } else {
      throw e;
    }
  }

  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error('O modelo recusou responder: ' + choice.message.refusal);
  if (choice?.finish_reason === 'length') {
    throw new Error('A resposta ficou a meio (limite de tokens). Pede menos coisas de cada vez.');
  }
  const text = choice?.message?.content;
  if (!text) throw new Error('A OpenAI devolveu uma resposta vazia.');
  return text;
}

/** Lista os modelos de conversa disponíveis nesta conta, do mais recente para o mais antigo. */
export async function listOpenAIModels(key) {
  const data = await openaiFetch('/models', key);
  return (data.data || [])
    .map((m) => ({ id: m.id, created: m.created || 0 }))
    .filter((m) => /^(gpt|o\d|chatgpt)/i.test(m.id))
    .filter((m) => !/(audio|realtime|transcribe|tts|image|search|embedding|moderation|dall|whisper|instruct)/i.test(m.id))
    .sort((a, b) => b.created - a.created)
    .map((m) => m.id);
}

/**
 * Escolhe sozinho o melhor modelo disponível: prefere o gpt de número mais
 * alto que não seja "mini"/"nano", e nunca inventa nomes — só usa o que a
 * conta tem mesmo.
 */
export async function pickBestOpenAIModel(key) {
  const models = await listOpenAIModels(key);
  if (!models.length) throw new Error('Esta chave da OpenAI não tem acesso a nenhum modelo de conversa.');

  const score = (id) => {
    let pts = 0;
    const gpt = id.match(/^gpt-(\d+)(?:\.(\d+))?/i);
    if (gpt) pts += 1000 + Number(gpt[1]) * 100 + Number(gpt[2] || 0) * 10;
    else if (/^o(\d)/i.test(id)) pts += 900 + Number(id.match(/^o(\d)/i)[1]) * 10;
    if (/mini/i.test(id)) pts -= 30;
    if (/nano/i.test(id)) pts -= 60;
    if (/preview|latest|chatgpt/i.test(id)) pts -= 5;
    if (/\d{4}-\d{2}-\d{2}/.test(id)) pts -= 3;   // prefere o alias sem data
    return pts;
  };

  return models.slice().sort((a, b) => score(b) - score(a))[0];
}

/* ============================================================
   Anthropic
   ============================================================ */

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@latest/+esm';
const EFFORT_OK = new Set(['claude-opus-5', 'claude-sonnet-5']);
let clientPromise = null;

async function getAnthropic(apiKey) {
  if (!clientPromise || clientPromise.key !== apiKey) {
    clientPromise = (async () => {
      const mod = await import(/* @vite-ignore */ SDK_URL);
      const Anthropic = mod.default || mod.Anthropic;
      return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    })();
    clientPromise.key = apiKey;
  }
  return clientPromise;
}

async function askAnthropic(messages, onStatus) {
  const s = state.settings;
  if (!s.aiKey) throw new Error('Falta a chave da Anthropic (⚙ Definições).');

  onStatus('a ligar…');
  const client = await getAnthropic(s.aiKey).catch((e) => { throw new Error(networkHint(e)); });

  const params = {
    model: s.aiModel || 'claude-opus-5',
    max_tokens: 32000,
    system: SYSTEM,
    messages,
    output_config: {
      format: { type: 'json_schema', schema: buildSchema('anthropic') },
      ...(EFFORT_OK.has(s.aiModel) ? { effort: s.aiEffort || 'high' } : {}),
    },
  };

  onStatus('a pensar…');

  let message;
  try {
    message = await client.messages.stream(params).finalMessage();
  } catch (err) {
    throw new Error(anthropicError(err));
  }

  if (message.stop_reason === 'refusal') throw new Error('O modelo recusou responder a este pedido.');
  if (message.stop_reason === 'max_tokens') {
    throw new Error('A resposta ficou a meio (limite de tokens). Pede menos coisas de cada vez.');
  }
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function anthropicError(err) {
  const msg = String(err?.message || err);
  if (err?.status === 401) return 'Chave da Anthropic inválida. Confirma nas definições.';
  if (err?.status === 429) return 'Demasiados pedidos seguidos. Espera um pouco e tenta outra vez.';
  if (err?.status === 400 && /credit|balance/i.test(msg)) return 'A conta da Anthropic não tem saldo.';
  return networkHint(err);
}

/* ============================================================
   Erros de rede (comuns aos dois)
   ============================================================ */

function networkHint(err) {
  const msg = String(err?.message || err);
  if (/Failed to (fetch|resolve) (dynamically imported )?module/i.test(msg)) {
    return 'Não consegui carregar a biblioteca da Anthropic (CDN bloqueado?). Verifica a ligação à internet.';
  }
  if (/Failed to fetch|NetworkError|CORS|Load failed/i.test(msg)) {
    return location.protocol === 'file:'
      ? 'A partir de um ficheiro local (file://) o navegador bloqueia o pedido. Abre a app com o iniciar.bat — vê o README.'
      : 'Não consegui contactar a API. Verifica a ligação à internet.';
  }
  return msg;
}

/* ============================================================
   Descrição legível das ações
   ============================================================ */

export function describeAction(a) {
  const d = a.day ? `dia ${a.day}` : '';
  switch (a.op) {
    case 'add_place':
      return `➕ ${a.name || a.query} → ${d}${a.time ? ' às ' + a.time : ''}`;
    case 'remove_item':
      return `➖ remover a paragem ${a.item_index} do ${d}`;
    case 'move_item':
      return `↔ mover a paragem ${a.item_index} do ${d} para o dia ${a.to_day}`;
    case 'update_item':
      return `✎ ${d}, paragem ${a.item_index}: ` + [
        a.time && `hora ${a.time}`,
        a.duration_min && `${a.duration_min} min`,
        a.cost != null && `${a.cost}€`,
        a.name && `nome "${a.name}"`,
        a.note && 'nota nova',
      ].filter(Boolean).join(', ');
    case 'reorder_day':
      return `🔀 reordenar o ${d}: ${(a.order || []).join(' → ')}`;
    case 'set_day_note':
      return `📝 nota do ${d}`;
    case 'clear_day':
      return `🗑️ esvaziar o ${d}`;
    case 'add_day':
      return '📅 acrescentar um dia';
    default:
      return a.op;
  }
}
