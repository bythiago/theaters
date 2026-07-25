import { getTheaters, getSessions } from './api.js';
import { flattenSessions, findNextSessions, buildMarathon } from './scheduler.js';
import {
  populateSelect,
  showLoading,
  showError,
  showEmpty,
  showToast,
  renderSessionList,
  renderNextSessions,
  renderMarathon,
} from './ui.js';

// --- State ---
const state = {
  theaters: [],
  cities: [],
  sessions: [],
  selectedDate: null,
  marathon: [],
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
  progressFill: document.getElementById('progress-fill'),
};

const progressSteps = document.querySelectorAll('.progress-step');

// --- Progress bar ---
function updateProgress(activeStep) {
  const total = 5;
  const pct = ((activeStep - 1) / (total - 1)) * 100;
  els.progressFill.style.width = `${pct}%`;

  progressSteps.forEach(step => {
    const n = parseInt(step.dataset.step, 10);
    step.classList.remove('progress-step--active', 'progress-step--done');
    if (n < activeStep) step.classList.add('progress-step--done');
    else if (n === activeStep) step.classList.add('progress-step--active');
  });
}

function scrollToActiveStep(el) {
  if (el) {
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

// --- Init ---
export async function init() {
  showLoading(els.sessionList);
  updateProgress(1);

  try {
    const theaters = await getTheaters();
    state.theaters = theaters;

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

    showEmpty(els.sessionList, 'Selecione uma cidade para começar.', '🏙️');
  } catch (err) {
    showToast(`Erro ao carregar cinemas: ${err.message}`, 'error');
    showEmpty(els.sessionList, 'Erro ao carregar cinemas. Tente novamente.', '⚠️');
  }
}

// --- Event: city selected ---
els.citySelect.addEventListener('change', () => {
  const cityId = els.citySelect.value;
  state.marathon = [];
  resetStep('theater');
  updateProgress(1);

  if (!cityId) {
    populateSelect(els.theaterSelect, [], 'Selecione o cinema');
    return;
  }

  const theatersInCity = state.theaters.filter(t => String(t.cityId) === String(cityId));
  const options = theatersInCity
    .map(t => ({ value: JSON.stringify({ id: t.id, cityId: t.cityId }), label: t.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  populateSelect(els.theaterSelect, options, 'Selecione o cinema');
  updateProgress(2);
  scrollToActiveStep(els.stepDate);
});

// --- Event: theater selected ---
els.theaterSelect.addEventListener('change', async () => {
  const raw = els.theaterSelect.value;
  state.marathon = [];
  resetStep('date');
  updateProgress(2);

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
    const dateGroups = Array.isArray(raw) ? raw : (raw.dates || []);

    const dates = dateGroups
      .map(g => {
        const d = g.date || g.localDate?.substring(0, 10);
        return { value: d, label: formatDateLabel(d), raw: g };
      })
      .filter(d => d.value);

    state._dateGroups = dateGroups;

    populateSelect(els.dateSelect, dates, 'Selecione a data');
    els.stepDate.classList.add('step--active');

    updateProgress(3);
    scrollToActiveStep(els.stepDate);

    if (dates.length > 0) {
      showEmpty(els.sessionList, 'Selecione uma data para ver as sessões.', '📅');
    } else {
      showEmpty(els.sessionList, 'Nenhuma sessão disponível para este cinema.', '🎞️');
    }
  } catch (err) {
    showToast(`Erro ao carregar sessões: ${err.message}`, 'error');
    showEmpty(els.sessionList, 'Erro ao carregar sessões. Tente novamente.', '⚠️');
    populateSelect(els.dateSelect, [], 'Selecione a data');
  }
});

// --- Event: date selected ---
els.dateSelect.addEventListener('change', () => {
  const date = els.dateSelect.value;
  state.marathon = [];
  resetStep('sessions');
  updateProgress(3);

  if (!date) {
    showEmpty(els.sessionList, 'Selecione uma data.', '📅');
    return;
  }

  state.selectedDate = date;
  const flat = flattenSessions(state._dateGroups || [], date);
  state.sessions = flat;

  renderSessionList(els.sessionList, flat, onSessionSelect);
  els.stepSessions.classList.add('step--active');

  renderMarathon(els.marathonPanel, null, onRemoveStep);
  showEmpty(els.nextSessions, 'Selecione a primeira sessão para ver sugestões.', '🎞️');
  scrollToActiveStep(els.stepSessions);
});

// --- Session selected (any step) ---
function onSessionSelect(session) {
  state.marathon = [session];
  updateNextSessions();
  updateMarathon();
}

function onNextSessionSelect(session) {
  state.marathon.push(session);
  updateNextSessions();
  updateMarathon();
  scrollToActiveStep(els.stepMarathon);
}

function onRemoveStep(index) {
  state.marathon = state.marathon.slice(0, index);
  updateNextSessions();
  updateMarathon();
}

function updateNextSessions() {
  if (state.marathon.length === 0) {
    showEmpty(els.nextSessions, 'Selecione a primeira sessão para ver sugestões.', '🎞️');
    updateProgress(3);
    return;
  }

  const last = state.marathon[state.marathon.length - 1];
  const suggestions = findNextSessions(last, state.sessions);

  const selectedIds = new Set(state.marathon.map(s => s.sessionId));
  const filtered = suggestions.filter(s => !selectedIds.has(s.sessionId));

  const step = state.marathon.length;
  renderNextSessions(els.nextSessions, filtered, step, onNextSessionSelect);
  els.stepNext.classList.add('step--active');
  updateProgress(4);
}

function updateMarathon() {
  const marathon = buildMarathon(state.marathon);
  renderMarathon(els.marathonPanel, marathon, onRemoveStep);
  if (marathon) {
    els.stepMarathon.classList.add('step--active');
    updateProgress(5);
  } else {
    els.stepMarathon.classList.remove('step--active');
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
    showEmpty(els.sessionList, 'Selecione uma data para ver as sessões.', '📅');
    els.stepSessions.classList.remove('step--active');
  }
  if (idx <= 3) {
    showEmpty(els.nextSessions, 'Selecione a primeira sessão para ver sugestões.', '🎞️');
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
