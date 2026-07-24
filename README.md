# Cinema Marathon Planner

Planeje sua sessão dupla (ou tripla) no cinema.

## Running the project

**Backend** (Flask proxy, port 8080):
```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

**Frontend** (arquivos estáticos, port 3000):
```bash
npx serve . -p 3000
# ou
python -m http.server 3000
```

Acesse http://localhost:3000 (frontend) — o backend roda em http://localhost:8080.

**Docker:**
```bash
docker compose up --build    # build + run em http://localhost:8080
docker compose down          # parar
```

> **WSL2:** O Flask escuta em `0.0.0.0`. Para acessar do navegador no Windows, configure um proxy de porta no PowerShell (admin):
> ```powershell
> netsh interface portproxy add v4tov4 listenport=8080 listenaddress=127.0.0.1 connectport=8080 connectaddress=<WSL_IP>
> ```
> Descubra o IP do WSL com `ip addr show eth0`.

## Architecture

App de dois processos, sem build step. O frontend usa ES modules nativos (`type="module"`) e **precisa ser servido** — abrir `index.html` como `file://` não funciona.

- **`server.py`** — Proxy Flask que encaminha requests para `https://api-content.ingresso.com/v0` com `partnership=home`. Gerencia CORS. Serve arquivos estáticos via catch-all. Três endpoints: `/theaters`, `/theaters/city/<id>`, `/sessions/city/<city_id>/theater/<theater_id>`.

- **`src/api.js`** — Wrapper de fetch com cache em memória (`Map`). Hardcoded para `http://localhost:8080`.

- **`src/scheduler.js`** — Lógica pura (sem DOM). `flattenSessions()` normaliza a resposta aninhada da API (`dateGroups → movies → rooms → sessions`) em um array plano, filtrando por data e pulando sessões com `enabled: false`. `findNextSessions()` filtra por janela de espera (padrão 15–180 min) e atribui viabilidade: `ideal` (≤60 min), `ok` (≤120 min), `long_wait` (>120 min). `buildMarathon()` calcula estatísticas de um conjunto ordenado de sessões selecionadas.

- **`src/app.js`** — Orquestra estado e eventos do DOM. Estado: `theaters`, `cities`, `sessions` (plano), `marathon` (sessões ordenadas), `selectedDate`, `_dateGroups` (dados brutos da API). Seleção estritamente sequencial: cidade → teatro → data → primeira sessão → sessões adicionais. `resetStep(from)` reseta etapas cascata.

- **`src/ui.js`** — Funções de renderização pura (recebem dados + callbacks, escrevem `innerHTML`, anexam listeners). `renderSessionList` agrupa sessões por `movieId`. `renderNextSessions` e `renderMarathon` usam o campo `feasibility` para aplicar classes CSS (`--ideal`, `--ok`, `--long_wait`).

- **`index.html`** — Single page com layout sidebar/conteúdo. Etapas 1–3 (cidade/teatro/data/lista) ficam na `.sidebar`; etapas 4–5 (sugestões + maratona) ficam no `.content`. Etapas ficam visíveis via classe `step--active`.

## Fluxo de dados

1. `getTheaters()` retorna todos os teatros; cidades são derivadas no client via `theater.cityId/cityName`.
2. O valor do `<select>` de teatro é uma JSON string `{id, cityId}` para evitar buscas extras.
3. `getSessions()` retorna o array cru salvo em `state._dateGroups`; `flattenSessions(state._dateGroups, date)` é chamado a cada troca de data.
4. A maratona é construída incrementalmente: primeira sessão via `onSessionSelect`, adicionais via `onNextSessionSelect`. Remover etapa `i` trunca `state.marathon` para `[0..i)` e recalcula sugestões.
