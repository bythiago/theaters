import { getTheaters, getSessions } from './api.js';
import { flattenSessions, findNextSessions, buildMarathon } from './scheduler.js';
import {
  populateSelect,
  showLoading,
  showError,
  showEmpty,
  renderSessionList,
  renderNextSessions,
  renderMarathon,
} from './ui.js';

// --- State ---
const state = {
  theaters: [],        // all theaters from API
  cities: [],          // unique cities
  sessions: [],        // flat sessions for selected theater+date
  selectedDate: null,
  marathon: [],        // ordered list of selected session objects
};

// --- DOM refs ---
const els = {
  citySelect: document.getElementById('city-select'),
  theaterSelect: document.getElementById('theater-select'),
  dateSelect: document.getElementById('date-select'),
  sessionList: document.getElementById('session-list'),
  nextSessions: document.getElementById('next-sessions'),
  marathonPanel: document.getElementById('marathon-panel'),
  stepDate: document.getElementById('step-date'),
  stepSessions: document.getElementById('step-sessions'),
  stepNext: document.getElementById('step-next'),
  stepMarathon: document.getElementById('step-marathon'),
};

// --- Init ---
export async function init() {
  showLoading(els.sessionList);

  try {
    const theaters = await getTheaters();
    state.theaters = theaters;

    // Extract unique cities sorted by name
    const cityMap = new Map();
    for (const t of theaters) {
      if (t.cityId && t.cityName && !cityMap.has(t.cityId)) {
        cityMap.set(t.cityId, t.cityName);
      }
    }

    state.cities = [...cityMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

    populateSelect(els.citySelect, state.cities, 'Selecione a cidade');
    els.citySelect.disabled = false;

    showEmpty(els.sessionList, 'Selecione uma cidade para começar.');
  } catch (err) {
    showError(els.sessionList, `Erro ao carregar cinemas: ${err.message}`);
  }
}

// --- Event: city selected ---
els.citySelect.addEventListener('change', () => {
  const cityId = els.citySelect.value;
  state.marathon = [];
  resetStep('theater');

  if (!cityId) {
    populateSelect(els.theaterSelect, [], 'Selecione o cinema');
    return;
  }

  const theatersInCity = state.theaters.filter(t => String(t.cityId) === String(cityId));
  const options = theatersInCity
    .map(t => ({ value: JSON.stringify({ id: t.id, cityId: t.cityId }), label: t.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  populateSelect(els.theaterSelect, options, 'Selecione o cinema');
});

// --- Event: theater selected ---
els.theaterSelect.addEventListener('change', async () => {
  const raw = els.theaterSelect.value;
  state.marathon = [];
  resetStep('date');

  if (!raw) {
    populateSelect(els.dateSelect, [], 'Selecione a data');
    return;
  }

  const { id: theaterId, cityId } = JSON.parse(raw);

  showLoading(els.sessionList);
  populateSelect(els.dateSelect, [], 'Carregando...');
  els.dateSelect.disabled = true;

  try {
    const raw = await getSessions(cityId, theaterId);
    // raw is array of date groups
    const dateGroups = Array.isArray(raw) ? raw : (raw.dates || []);

    // Extract available dates
    const dates = dateGroups
      .map(g => {
        const d = g.date || g.localDate?.substring(0, 10);
        return { value: d, label: formatDateLabel(d), raw: g };
      })
      .filter(d => d.value);

    state._dateGroups = dateGroups;

    populateSelect(els.dateSelect, dates, 'Selecione a data');
    els.stepDate.classList.add('step--active');

    if (dates.length > 0) {
      showEmpty(els.sessionList, 'Selecione uma data para ver as sessões.');
    } else {
      showEmpty(els.sessionList, 'Nenhuma sessão disponível para este cinema.');
    }
  } catch (err) {
    showError(els.sessionList, `Erro ao carregar sessões: ${err.message}`);
    populateSelect(els.dateSelect, [], 'Selecione a data');
  }
});

// --- Event: date selected ---
els.dateSelect.addEventListener('change', () => {
  const date = els.dateSelect.value;
  state.marathon = [];
  resetStep('sessions');

  if (!date) {
    showEmpty(els.sessionList, 'Selecione uma data.');
    return;
  }

  state.selectedDate = date;
  const flat = flattenSessions(state._dateGroups || [], date);
  state.sessions = flat;

  renderSessionList(els.sessionList, flat, onSessionSelect);
  els.stepSessions.classList.add('step--active');

  renderMarathon(els.marathonPanel, null, onRemoveStep);
  showEmpty(els.nextSessions, 'Selecione a primeira sessão para ver sugestões.');
});

// --- Session selected (any step) ---
function onSessionSelect(session) {
  // First selection: start the marathon
  if (state.marathon.length === 0) {
    state.marathon = [session];
  } else {
    // This is called from the "next sessions" list — handled via onNextSessionSelect
    // This branch handles re-picking from the full list when marathon is empty
    state.marathon = [session];
  }

  updateNextSessions();
  updateMarathon();
}

function onNextSessionSelect(session) {
  state.marathon.push(session);
  updateNextSessions();
  updateMarathon();
  // Scroll to marathon panel
  els.stepMarathon.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onRemoveStep(index) {
  // Remove from index onward (can't remove step 0)
  state.marathon = state.marathon.slice(0, index);
  updateNextSessions();
  updateMarathon();
}

function updateNextSessions() {
  if (state.marathon.length === 0) {
    showEmpty(els.nextSessions, 'Selecione a primeira sessão para ver sugestões.');
    return;
  }

  const last = state.marathon[state.marathon.length - 1];
  const suggestions = findNextSessions(last, state.sessions);

  // Filter out already selected sessions
  const selectedIds = new Set(state.marathon.map(s => s.sessionId));
  const filtered = suggestions.filter(s => !selectedIds.has(s.sessionId));

  const step = state.marathon.length;
  renderNextSessions(els.nextSessions, filtered, step, onNextSessionSelect);
  els.stepNext.classList.add('step--active');
}

function updateMarathon() {
  const marathon = buildMarathon(state.marathon);
  renderMarathon(els.marathonPanel, marathon, onRemoveStep);
  if (marathon) {
    els.stepMarathon.classList.add('step--active');
  }
}

// --- Helpers ---

function resetStep(from) {
  const steps = ['theater', 'date', 'sessions', 'next', 'marathon'];
  const idx = steps.indexOf(from);

  if (idx <= 0) {
    populateSelect(els.theaterSelect, [], 'Selecione o cinema');
  }
  if (idx <= 1) {
    populateSelect(els.dateSelect, [], 'Selecione a data');
    els.stepDate.classList.remove('step--active');
  }
  if (idx <= 2) {
    showEmpty(els.sessionList, 'Selecione uma data para ver as sessões.');
    els.stepSessions.classList.remove('step--active');
  }
  if (idx <= 3) {
    showEmpty(els.nextSessions, 'Selecione a primeira sessão para ver sugestões.');
    els.stepNext.classList.remove('step--active');
  }
  if (idx <= 4) {
    renderMarathon(els.marathonPanel, null, onRemoveStep);
    els.stepMarathon.classList.remove('step--active');
  }
}

function formatDateLabel(dateStr) {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return `Hoje (${d}/${m})`;
  if (date.getTime() === tomorrow.getTime()) return `Amanhã (${d}/${m})`;

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${weekdays[date.getDay()]} ${d}/${m}`;
}
