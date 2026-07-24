# Cinema Marathon Planner — Plano de Implementação

## Context

O usuário quer um sistema que, dado um cinema e uma data, permita planejar a assistência de dois ou mais filmes em sequência. O sistema deve calcular automaticamente o tempo de espera entre sessões com base no horário de início e duração de cada filme, sugerindo a próxima sessão compatível.

---

## APIs Disponíveis

| Endpoint | Uso |
|---|---|
| `GET /v0/theaters?partnership=home` | Lista todos os cinemas (com `cityId`, `cityName`) |
| `GET /v0/theaters/city/{cityId}?partnership=home` | Cinemas de uma cidade |
| `GET /v0/templates/nowplaying/{cityId}?partnership=home` | Filmes em cartaz com `duration` (minutos) |
| `GET /v0/sessions/city/{cityId}/theater/{theaterId}?partnership=home` | Sessões agrupadas por data, com `time` (HH:MM) e `duration` |

### Campos-chave para o agendamento

- **`duration`**: string com minutos do filme (ex: `"120"`) — presente em API 3 e API 4
- **`time`**: string `"HH:MM"` com horário da sessão — presente em API 4
- **`date.localDate`**: ISO 8601 timestamp completo da sessão
- **`movies[].rooms[].sessions[]`**: sessões aninhadas dentro do filme → data → sala

---

## Arquitetura do Sistema

**Stack:** Vanilla JS + HTML + CSS (sem dependências externas, sem build tools)

```
theaters/
├── index.html              # UI principal
├── styles/
│   └── main.css            # Estilos
└── src/
    ├── api.js              # Chamadas às APIs (fetch + cache)
    ├── scheduler.js        # Lógica de cálculo de sequências
    ├── ui.js               # Renderização de componentes
    └── app.js              # Ponto de entrada e fluxo principal
```

---

## Fluxo do Usuário

```
1. Carregar app
   └── Busca todos os cinemas (API 1)
   └── Extrai cidades únicas para o seletor

2. Usuário seleciona cidade
   └── Filtra cinemas da cidade (API 2 ou filtro local)

3. Usuário seleciona cinema
   └── Busca sessões do cinema (API 4)
   └── Extrai datas disponíveis

4. Usuário seleciona data
   └── Lista todos os filmes com suas sessões naquele dia

5. Usuário seleciona a primeira sessão
   └── Scheduler calcula todas as próximas sessões compatíveis
   └── Exibe sequência sugerida com tempo de espera entre filmes

6. (Opcional) Usuário adiciona mais filmes à sequência
   └── Recalcula a partir do novo ponto de partida
```

---

## Lógica do Scheduler (`src/scheduler.js`)

```js
// Para cada sessão candidata "próxima":
endTime = startTime + durationMinutes
waitMinutes = nextSession.startMinutes - endTime

// Regras:
// - waitMinutes >= 0       → sessão válida (começa depois que o anterior termina)
// - waitMinutes >= 15      → mínimo recomendado (deslocamento entre salas)
// - waitMinutes <= 180     → máximo sugerido (3h de espera)

// Resultado por sessão candidata:
{
  movie: { title, duration, contentRating },
  session: { time, room, type },
  waitMinutes,        // tempo de espera após o filme anterior
  waitFormatted,      // "30 min" ou "1h 10min"
  feasibility,        // "ideal" | "ok" | "longa_espera"
}
```

**Suporte a maratona de N filmes:**
- Selecionada a 2ª sessão, o scheduler recalcula a partir do fim dela
- Interface permite adicionar quantos filmes quiser à sequência
- Exibe resumo total: horário início, horário fim estimado, duração total

---

## Componentes de UI (`src/ui.js`)

1. **Seletores em cascata**: Cidade → Cinema → Data
2. **Lista de sessões do dia**: filme, horário, sala, tipo (dublado/legendado)
3. **Card de sessão selecionada**: poster, título, horário, duração
4. **Lista de próximas sessões**: ordenadas por tempo de espera, com badge de espera colorido
   - Verde: 15–60 min
   - Amarelo: 60–120 min
   - Vermelho: > 120 min ou < 15 min
5. **Linha do tempo da maratona**: visualização horizontal da sequência planejada

---

## Arquivos Críticos a Criar

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura da página, imports |
| `styles/main.css` | Layout responsivo, badges de espera |
| `src/api.js` | `getTheaters()`, `getTheatersByCity()`, `getSessions(cityId, theaterId)` com cache em memória |
| `src/scheduler.js` | `findNextSessions(currentSession, allSessions, options)`, `buildMarathon(sessions[])` |
| `src/ui.js` | `renderSessionList()`, `renderNextSessions()`, `renderTimeline()` |
| `src/app.js` | Init, event handlers, state management |

---

## Detalhes de Implementação

### `src/api.js`
- Cache simples em Map para evitar re-fetches
- Constante `BASE_URL = 'https://api-content.ingresso.com/v0'`
- Constante `PARTNERSHIP = 'home'`
- Tratar erros de rede com mensagem amigável

### `src/scheduler.js`
```js
// Converter "HH:MM" para minutos do dia
function timeToMinutes(time) // "14:30" → 870

// Encontrar sessões compatíveis após uma sessão atual
function findNextSessions(currentSession, allSessions, { minWait = 15, maxWait = 180 })

// Construir sequência completa de maratona
function buildMarathon(selectedSessions)
// retorna: { sessions[], totalDuration, startTime, endTime }
```

### Parsing de sessões (API 4)
```
response[] (por data)
  └── .movies[]
        ├── .title, .duration
        └── .rooms[]
              └── .sessions[]
                    ├── .time        ← "HH:MM"
                    ├── .type[]      ← ["Dublado"], ["Legendado"]
                    ├── .room
                    └── .enabled
```

---

## Verificação / Como Testar

1. Abrir `index.html` no browser (sem servidor necessário, ou `npx serve .`)
2. Selecionar cidade "São Paulo" (cityId 286 já nos exemplos da API)
3. Selecionar um cinema da lista
4. Escolher a data de hoje
5. Clicar em uma sessão das 13:00
6. Verificar que o sistema exibe sessões posteriores com tempo de espera correto
7. Adicionar um 2º filme e verificar o recálculo
8. Testar caso edge: última sessão do dia (sem próximos filmes disponíveis)
9. Testar com filme de longa duração (3h+) para verificar filtro de espera máxima
