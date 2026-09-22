# Roteiro Roma

Planeador de viagem para Roma: roteiro dia a dia, mapa com os trajetos em 2D e 3D,
pesquisa de restaurantes e monumentos, controlo de bilhetes e um assistente de IA
que mexe no roteiro por ti.

Tudo corre no navegador. Não há servidor, não há conta, não há base de dados —
o roteiro fica guardado no teu computador.

---

## Como arrancar

### No computador (para planear)

Faz duplo clique em **`iniciar.bat`**. Abre em `http://localhost:5173` e fica a
correr até fechares a janela preta.

> **Não abras o `index.html` diretamente com duplo clique.** A partir de `file://`
> o navegador bloqueia os pedidos ao Google Maps e à API da IA, e nada funciona.

### No telemóvel (para a viagem)

Há duas formas, e a diferença entre elas é decisiva.

**Rede local — serve para experimentar em casa.** O `iniciar.bat` já aceita
ligações do telemóvel: quando arranca, escreve na janela preta o endereço a usar
(`http://192.168.x.x:5173`). Basta o telemóvel estar no mesmo Wi-Fi e o portátil
ligado. **Não funciona sem rede nem fora de casa.**

**Publicar — é isto que serve em Roma.** O modo offline só funciona em HTTPS; os
navegadores recusam-se a instalar um *service worker* fora disso.

#### Vercel (recomendado)

Já está tudo configurado: o repositório git existe, com o primeiro commit feito,
e o `vercel.json` trata dos cabeçalhos.

**1. Criar o repositório no GitHub** — <https://github.com/new>:

- Nome: `roteiro-roma`
- **Private** — o roteiro e a checklist são pessoais, e a Vercel publica
  repositórios privados na mesma no plano gratuito
- **Não** marques nada em *Initialize this repository* (nem README, nem
  `.gitignore`, nem licença) — já existem aqui e dariam conflito

**2. Enviar o código** — num terminal na pasta `AppRoteiro`:

```
git remote add origin https://github.com/O-TEU-UTILIZADOR/roteiro-roma.git
git push -u origin main
```

Da primeira vez abre o navegador para entrares na conta do GitHub.

**3. Ligar à Vercel** — <https://vercel.com/new> → *Import Git Repository* →
escolhe `roteiro-roma` → **Deploy**. Não mexas em mais nada: não há nada para
compilar e a Vercel serve os ficheiros como estão.

Em menos de um minuto tens `https://roteiro-roma.vercel.app`.

**A partir daí, publicar é só isto:**

```
git add -A
git commit -m "o que mudaste"
git push
```

Cada envio para o ramo `main` republica sozinho, e a app avisa no telemóvel que
há versão nova.

> Ramos que não sejam o `main` recebem endereços de pré-visualização temporários.
> Como a chave do Google vai ficar restringida ao endereço fixo, o mapa só
> funciona no endereço de produção — trabalha no `main` e não tens com que te
> preocupar.

#### Depois de publicar

1. **Acrescenta o endereço às restrições da chave Google** —
   <https://console.cloud.google.com/apis/credentials> → a tua chave →
   *Restrições de aplicação* → *Sites* → `https://o-teu-nome.vercel.app/*`.
   Sem isto o mapa deixa de aparecer.
2. Abre o endereço no telemóvel e mete as chaves em **⚙**.
3. Adiciona ao ecrã inicial: no Android é *Instalar app*, no iPhone é
   *Partilhar → Adicionar ao ecrã principal*.

A partir daí abre como uma app normal, em ecrã inteiro, e **funciona sem rede**.

> **Sem passar pelo GitHub:** `npx vercel --prod` dentro da pasta publica
> diretamente a partir do computador. Funciona, mas obriga a repetir o comando a
> cada alteração, e sem o `--prod` cada publicação recebe um endereço diferente.

## Levar o roteiro do computador para o telemóvel

O roteiro vive no navegador de cada aparelho, por isso não passa sozinho.

1. No computador: **Exportar → Guardar ficheiro (.json)**
2. Envia o ficheiro para ti próprio (email é o mais fiável; o WhatsApp às vezes
   recusa `.json`)
3. No telemóvel, na app publicada: **Exportar → Abrir ficheiro (.json)**

As chaves de API não vão no ficheiro — tens de as colar no telemóvel uma vez.
Depois disso ficam guardadas lá.

## Sem rede, o que é que continua a funcionar

| Funciona | Não funciona |
|---|---|
| Roteiro completo, com horas, custos e notas | O mapa dentro da app |
| Checklist de comida | Pesquisar sítios novos |
| Bilhetes e códigos de reserva | O assistente de IA |
| Botão **➤** que abre a app Google Maps | Previsão do tempo |

O **➤** em cada paragem e o **Maps ↗** no topo do dia abrem a aplicação nativa do
Google Maps, que é o que serve para navegar a pé — e essa funciona com os mapas
que tenhas descarregado. Descarrega a zona de Roma no Google Maps antes de ir:
*perfil → Mapas offline → Selecionar o seu próprio mapa*.

---

## As duas chaves

Carrega no **⚙** no canto superior direito. Sem chaves a app abre na mesma, mas
fica sem mapa e sem IA.

### 1. Google Maps — mapa, trajetos e pesquisa de sítios

1. Vai a <https://console.cloud.google.com/> e cria um projeto.
2. Ativa estas três APIs (procura cada uma na barra de pesquisa da consola):
   - **Maps JavaScript API** — o mapa
   - **Places API (New)** — a pesquisa de restaurantes, museus, etc.
   - **Directions API** — os trajetos entre paragens
3. Em *Credenciais* → *Criar credenciais* → *Chave de API*. Copia a chave.
4. **Restringe a chave** (importante): *Restrições de aplicação* → *Sites* →
   acrescenta `http://localhost:5173/*`.
5. Cola a chave nas definições da app.

A Google dá crédito mensal gratuito que chega e sobra para planear uma viagem,
mas é preciso ter faturação ativa no projeto.

**Map ID** (opcional, para o 3D ficar bonito): em *Google Maps Platform* → *Map
Management* → *Criar Map ID* → tipo **JavaScript**, **Vetorial**, com inclinação e
rotação ativadas. Cola o ID nas definições. Sem isto fica o `DEMO_MAP_ID`, que
serve para experimentar.

Para o botão **3D+** (mapa fotorrealista, aquele que mostra os edifícios a sério),
põe a *Versão* em **beta** nas definições.

### 2. O assistente de IA — OpenAI ou Anthropic

Nas definições escolhes o **Fornecedor**. Só precisas de uma das duas.

#### OpenAI (por omissão)

1. Vai a <https://platform.openai.com/api-keys> e cria uma chave (`sk-...`).
2. Confirma que tens créditos em <https://platform.openai.com/settings/organization/billing>.
3. Cola a chave nas definições e carrega em **Carregar modelos**.

O campo do modelo fica em **automático**: a app pergunta à tua conta que modelos
existem e usa o melhor que lá estiver. Assim nunca dá erro de "modelo não existe",
mesmo quando a OpenAI lança modelos novos. Se preferires um em concreto — por
exemplo um mais barato — escolhe-o na lista depois de a carregares.

#### Anthropic (Claude)

1. Cria uma chave em <https://console.anthropic.com/settings/keys> (`sk-ant-...`).
2. Mete crédito em <https://console.anthropic.com/settings/billing>.
3. Muda o *Fornecedor* para **Anthropic**, cola a chave e escolhe o modelo.

> Em qualquer dos casos a chave fica guardada neste navegador e é enviada
> diretamente do teu computador para a API. É seguro para uso pessoal no teu
> portátil. **Não ponhas esta app online com a chave lá dentro** — quem abrisse a
> página conseguia usá-la.

Custa cêntimos por pedido. Planear uma viagem inteira, com ajustes, fica bem
abaixo de 1 €.

---

## O que dá para fazer

### Roteiro
- Dias lado a lado no topo; setas ← → do teclado saltam entre eles.
- **Arrasta pelo número** da paragem para trocar a ordem, ou larga-a em cima de
  outro dia para a mudar de dia. Funciona com o dedo e com o rato; com o teclado,
  o número aceita ↑ e ↓.
- **➤** abre a paragem na app Google Maps; **Maps ↗** abre o percurso do dia todo.
- Depois de a IA mexer no roteiro aparece um **desfazer** durante alguns segundos.
- Entre cada duas paragens aparece o tempo de deslocação real (a pé, metro, carro
  ou bicicleta — escolhes no mapa).
- **Otimizar** reordena as paragens do dia para andares o menos possível,
  mantendo a primeira e a última no sítio.
- No fundo: tempo de visitas, tempo de deslocações, duração total e custo do dia.
- Previsão do tempo para Roma, quando a viagem está a menos de 16 dias.

### Explorar
- Pesquisa livre ou por categoria (restaurantes, gelato, museus, miradouros…).
- **Só perto da zona visível** limita a pesquisa ao que está à vista no mapa —
  útil para "onde jantamos perto do Panteão".
- Cada resultado dá para adicionar ao dia, guardar para depois (☆) ou abrir a
  ficha com horários, telefone, site e uma crítica.

### Comida
- Checklist dos 50 pratos a provar, divididos entre **romanas** (prioridade) e
  **italianas de outras regiões**, com barra de progresso.
- Cada prato diz para quem é: 🌿 para os dois · 🧀 leva queijo · 🐟 peixe.
- Filtros: **🌿 Para os dois** mostra só o que o Francisco pode comer; **Por comer**
  esconde o que já foi riscado.
- O 🔍 em cada prato procura no mapa onde o comer. Nos que têm casa certa
  (Pizzarium Bonci, Forno Campo de' Fiori, Two Sizes) vai direito lá.
- A frase *"Senza formaggio, per favore"* tem botão de copiar.
- A IA sabe o que já comeram: dá para pedir *"onde como o que ainda falta?"*.

### Bilhetes
- Tudo o que tem código de reserva aparece por ordem cronológica.
- Por baixo, um guia do que é mesmo preciso reservar antes de ir a Roma, com os
  sites oficiais e a antecedência recomendada.

### IA
Escreve em português como falarias com alguém. Exemplos que funcionam bem:

- *"Planeia-me os 4 dias. Gostamos de história e de comer bem, não queremos correr."*
- *"Dia 2 no Vaticano de manhã, tarde calma e jantar em Trastevere."*
- *"Este dia está muito cheio, tira o que for a mais e passa para o dia 4."*
- *"Sugere jantares românticos perto das paragens do dia 3, com preços."*
- *"O que é que tenho de reservar já?"*

O assistente **não mexe no roteiro sem autorização**: propõe as alterações numa
lista e só aplica quando carregas em *Aplicar*. Quando sugere sítios novos, vai
buscar a morada e as coordenadas ao Google Maps antes de os pôr no mapa.

### Guardar e partilhar
No menu **Exportar**:
- **.json** — cópia de segurança do roteiro (as chaves de API nunca vão no ficheiro).
- **.ics** — importa para o Google Calendar ou para o calendário do telemóvel.
- **Imprimir / PDF** — folha limpa com os dias todos, para levar impressa.

---

## Ficheiros

```
index.html        estrutura da página
css/styles.css    aspeto
js/config.js      categorias, guia de bilhetes, pontos de referência de Roma
js/food.js        a checklist de comida
js/store.js       o roteiro: dados, gravação no navegador, .json e .ics
js/maps.js        Google Maps: marcadores, trajetos, 2D/3D
js/places.js      pesquisa de sítios + meteorologia (Open-Meteo, sem chave)
js/ai.js          IA: contexto, esquema das respostas, OpenAI e Anthropic
js/links.js       atalhos para a app nativa do Google Maps
js/app.js         interface e ligação entre tudo
sw.js             service worker: é o que faz a app abrir sem rede
manifest.webmanifest  para instalar no ecrã inicial do telemóvel
icons/            ícones da app
servidor.mjs      servidor local (sem dependências)
iniciar.bat       arranca o servidor e abre o navegador
vercel.json       cabeçalhos para a publicação (cache do service worker)
.vercelignore     o que não vai para o site publicado
```

---

## Se alguma coisa não funcionar

| Sintoma | Causa provável |
|---|---|
| Mapa cinzento ou com marca de água | Faturação por ativar no projeto Google, ou chave restringida a outro endereço |
| "A Places API (New) não está ativa" | Falta ativar essa API — é diferente da Places API antiga |
| Pins não aparecem | Falta o Map ID, ou o que está lá não é vetorial |
| Botão 3D+ desativado | Põe a *Versão* em **beta** nas definições |
| Sem trajetos entre paragens | Falta a Directions API |
| IA responde "não consegui contactar" | Abriste o `index.html` por `file://` em vez do `iniciar.bat` |
| "O modelo não existe nesta conta" | Definições → **Carregar modelos** e escolhe um da lista (ou deixa em automático) |
| "Não tem créditos disponíveis" | Falta carregar a conta da OpenAI/Anthropic |
| Trocaste a chave do Google e nada mudou | Recarrega a página (F5) — a API do Google só carrega uma vez |
| Roteiro desapareceu | Limpaste os dados do navegador. É por isso que existe o Exportar → .json |
| No telemóvel não funciona sem rede | Estás pelo `192.168...`; o offline só existe em HTTPS — publica a app |
| Não aparece a opção de instalar no telemóvel | Idem: só em HTTPS, e tem de se abrir o endereço publicado |
| Publicaste e o mapa deixou de aparecer | Falta acrescentar o novo endereço às restrições da chave Google |
| Cada publicação dá um endereço diferente | Estás num ramo que não é o `main` (ou faltou `--prod`, se publicaste pelo terminal) |
| `git push` recusado por "rejected" | Marcaste README ou .gitignore ao criar o repositório no GitHub. Cria outro, vazio |
| Mudaste os ficheiros e o telemóvel mostra a versão antiga | Espera o aviso de "versão nova", ou fecha e reabre a app |

Boa viagem. 🏛️
