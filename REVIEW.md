# Relatório de Análise — Cinema Marathon Planner

## 1. Visão Geral

Aplicação SPA de planejamento de maratona de cinema com layout dark-themed, sidebar de seleção (cidade → cinema → data → sessão) e área de conteúdo com sugestões e timeline da maratona. Stack: Flask proxy + ES Modules nativos (zero build).

---

## 2. Pontos Positivos

- **Design dark coeso** — Paleta bem definida com variáveis CSS, boa hierarquia visual
- **Arquitetura limpa** — Separação clara: `api.js` (dados), `scheduler.js` (lógica), `ui.js` (render), `app.js` (orquestração)
- **Fluxo sequencial guiado** — Steps numerados com estados visuais (active/inactive)
- **Bem-tipado no CSS** — Nomenclatura BEM, uso consistente de custom properties
- **Sem dependências externas** — Zero build step, módulos nativos

---

## 3. Bugs e Problemas Críticos

### 3.1. API hardcoded para `localhost:8080` no frontend
**Arquivo:** `src/api.js:1`
```js
const BASE_URL = 'http://localhost:8080';
```
O `server.py` já serve os arquivos estáticos (catch-all), então o frontend sempre roda no mesmo host/porta do backend. O `BASE_URL` deveria ser relativo (`''` ou `window.location.origin`) para funcionar em qualquer ambiente (Docker, deploy, etc).

### 3.2. Erro de fetch durante carregamento inicial
Quando o app carrega, `getTheaters()` faz fetch para `http://localhost:8080/theaters` mas se o browser não consegue acessar essa URL diretamente (como no caso de acesso via IP diferente), o erro `Failed to fetch` é exibido na step 3 em vez de um feedback adequado na step 1.

### 3.3. Favicon 404
O servidor retorna 404 para `/favicon.ico`. Deveria haver um favicon configurado.

### 3.4. `renderMarathon` com `marathon=null` limpa o container silenciosamente
**Arquivo:** `src/ui.js:165-168`
```js
if (!marathon || !marathon.items.length) {
    container.innerHTML = '';
    return;
}
```
Quando a maratona é resetada, o container fica vazio mas o step header continua visível, mostrando "Sua maratona" com corpo vazio sem nenhum state visual.

### 3.5. `ordinal()` retorna apenas o número
**Arquivo:** `src/ui.js:256-258`
```js
function ordinal(n) {
    return n;
}
```
Deveria retornar "2º", "3º", "4º" etc. mas retorna apenas o número.

---

## 4. Melhorias de UX

### 4.1. Indicadores visuais de progresso
**Problema:** O usuário não sabe onde está no fluxo.
**Solução:** Adicionar uma barra de progresso ou stepper visual que mostre concluído/ativo/pendente:

```
[✓] Cinema  →  [✓] Data  →  [●] Sessão  →  [ ] Adicionar  →  [ ] Maratona
```

### 4.2. States vazios mais ricos
**Problema:** Os empty states são apenas texto cinza em itálico.
**Solução:** Adicionar ícones e contexto acional:
```
🎬
Selecione uma cidade para começar
Escolha uma cidade e cinema para ver as sessões disponíveis
```

### 4.3. Feedback de loading nos selects
**Problema:** Ao selecionar um cinema, o select de data mostra "Carregando..." mas a step de sessões mostra um spinner genérico.
**Solução:** Mostrar skeleton/placeholder cards nas sessões durante o loading, mantendo a estrutura visual.

### 4.4. Scroll automático inteligente
**Problema:** Ao selecionar um cinema, a step 2 (data) não aparece na tela se a sidebar estiver longa.
**Solução:** Scroll automático para a próxima step ativa (`scrollIntoView` já existe no `onNextSessionSelect` mas não nas outras transições).

### 4.5. Botão de limpar maratona
**Problema:** Para recomeçar, o usuário precisa remover item por item.
**Solução:** Adicionar um botão "Limpar maratona" no painel de resumo.

### 4.6. Toast/notification para erros
**Problema:** Erros aparecem inline, substituindo o conteúdo da step.
**Solução:** Usar um toast notification no canto da tela para erros de API, preservando o estado visual da step.

---

## 5. Melhorias de Design (Visual)

### 5.1. Header com gradiente mais cinematográfico
**Atual:** Gradiente sutil `#1a0a0a → #0f1117` com borda inferior.
**Sugestão:** Gradiente mais impactante com efeito de luz:
```css
.app-header {
  background: linear-gradient(135deg, #1a0a0a 0%, #1a1020 50%, #0f1117 100%);
  border-bottom: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}
.app-header::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -10%;
  width: 120%;
  height: 200%;
  background: radial-gradient(ellipse, rgba(108,99,255,.08) 0%, transparent 60%);
  pointer-events: none;
}
```

### 5.2. Cards com hover elevado e glow
**Atual:** `hover { border-color: var(--accent2) }` — apenas muda a borda.
**Sugestão:** Adicionar sombra sutil + translate no hover:
```css
.movie-card {
  transition: border-color .15s, transform .2s, box-shadow .2s;
}
.movie-card:hover {
  border-color: var(--accent2);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(108,99,255,.12);
}
```

### 5.3. Session buttons com micro-animação
**Atual:** Background muda no hover.
**Sugestão:** Adicionar scale sutil + ripple effect:
```css
.session-btn:hover {
  transform: scale(1.05);
  background: var(--border);
  border-color: var(--accent2);
}
.session-btn:active {
  transform: scale(0.98);
}
```

### 5.4. Wait badges com ícones
**Atual:** Apenas texto colorido (ex: "45min de espera").
**Sugestão:** Adicionar ícones para cada feasibility:
- ideal: `⏱️` ou `⚡` 
- ok: `⏰`
- long_wait: `⏳`

### 5.5. Timeline da maratona com connector visual
**Atual:** Wait blocks com linhas horizontais simples.
**Sugestão:** Conector vertical contínuo estilo railway:
```css
.timeline {
  position: relative;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border);
}
```

### 5.6. Summary card com gradiente de destaque
**Atual:** Fundo `surface2` flat.
**Sugestão:** Gradiente sutil + borda accent no bottom:
```css
.marathon-summary {
  background: linear-gradient(135deg, var(--surface2), var(--surface));
  border-top: 2px solid var(--accent2);
}
.summary-row--total {
  background: rgba(108,99,255,.06);
  border-radius: var(--radius-sm);
  padding: .5rem .75rem;
  margin: 0 -.75rem;
}
```

### 5.7. Steps com transition de entrada
**Sugestão:** Quando uma step ativa, ela deveria ter uma animação de fade-in + slide:
```css
.step {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity .3s, transform .3s;
}
.step--active {
  opacity: 1;
  transform: translateY(0);
}
```

### 5.8. Tipografia refinada
**Atual:** `'Segoe UI', system-ui, sans-serif`
**Sugestão:** Usar `Inter` do Google Fonts para melhor legibilidade em dark mode:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

---

## 6. Melhorias Técnicas

### 6.1. `BASE_URL` relativo
```js
const BASE_URL = window.location.origin;
```

### 6.2. Tratamento de erro com retry
```js
async function fetchJSON(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      if (cache.has(url)) return cache.get(url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache.set(url, data);
      return data;
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}
```

### 6.3. Debounce no change dos selects
Evitar múltiplos fetches se o usuário mudar rapidamente entre opções.

### 6.4. Cache com TTL
O `Map` cache atual nunca expira. Adicionar TTL de 5 minutos:
```js
function fetchJSON(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < 300_000) return cached.data;
  // ... fetch and store { data, ts: Date.now() }
}
```

### 6.5. Accessibility
- `aria-label` nos botões de sessão
- `role="status"` no loading spinner
- `aria-live="polite"` nos containers de mensagem
- Skip link para o conteúdo principal

### 6.6. Meta tags para mobile
```html
<meta name="theme-color" content="#0f1117">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

---

## 7. Resumo de Prioridades

| # | Item | Impacto | Esforço |
|---|------|---------|---------|
| 1 | `BASE_URL` relativo | Alto | Baixo |
| 2 | `ordinal()` corrigido | Médio | Baixo |
| 3 | States vazios com ícones | Alto | Baixo |
| 4 | Scroll automático nas steps | Médio | Baixo |
| 5 | Hover elevado nos cards | Alto | Baixo |
| 6 | Timeline connector vertical | Médio | Médio |
| 7 | Barra de progresso | Alto | Médio |
| 8 | Toast para erros | Alto | Médio |
| 9 | Cache com TTL | Médio | Baixo |
| 10 | Favicon | Baixo | Baixo |
| 11 | Botão limpar maratona | Médio | Baixo |
| 12 | Inter font + meta tags mobile | Médio | Baixo |
