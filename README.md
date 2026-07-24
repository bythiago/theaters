# Cinema Marathon Planner

Planeje sua sessão dupla (ou tripla) no cinema.

## Running the project

**Local:**
```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```
Acesse http://localhost:8080

**Docker:**
```bash
docker compose up --build
```

## Architecture

- **`server.py`** — Flask proxy (port 8080). Encaminha requests para a API do Ingresso e serve os arquivos estáticos do frontend.
- **`src/api.js`** — Wrapper de fetch com cache em memória.
- **`src/scheduler.js`** — Lógica de normalização de sessões, filtro por horário e cálculo de viabilidade.
- **`src/app.js`** — Orquestra estado e eventos do DOM.
- **`src/ui.js`** — Funções de renderização pura.
- **`index.html`** — Single page com layout sidebar/conteúdo.
