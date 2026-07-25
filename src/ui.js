/**
 * Populate a <select> element with options.
 * @param {HTMLSelectElement} select
 * @param {Array} items - { value, label }
 * @param {string} placeholder
 */
export function populateSelect(select, items, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    select.appendChild(opt);
  }
  select.disabled = items.length === 0;
}

/**
 * Show a loading spinner inside a container.
 */
export function showLoading(container) {
  container.innerHTML = '<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span> Carregando...</div>';
}

/**
 * Show an error message inside a container.
 */
export function showError(container, message) {
  container.innerHTML = `<div class="error-msg" role="alert">${message}</div>`;
}

/**
 * Show an info/empty state message with optional icon.
 */
export function showEmpty(container, message, icon) {
  const iconHTML = icon
    ? `<span class="empty-state__icon" aria-hidden="true">${icon}</span>`
    : '';
  container.innerHTML = `
    <div class="empty-state">
      ${iconHTML}
      <span class="empty-state__text">${message}</span>
    </div>`;
}

/**
 * Show a toast notification.
 */
export function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { error: '⚠️', info: 'ℹ️', success: '✅' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icons[type] || icons.error}</span>
    <span class="toast__text">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5200);
}

/**
 * Render the list of all sessions for the selected day.
 * Groups by movie.
 */
export function renderSessionList(container, sessions, onSelect) {
  if (!sessions.length) {
    showEmpty(container, 'Nenhuma sessão encontrada para esta data.', '🎞️');
    return;
  }

  const movies = new Map();
  for (const s of sessions) {
    if (!movies.has(s.movieId)) {
      movies.set(s.movieId, { title: s.movieTitle, poster: s.poster, contentRating: s.contentRating, sessions: [] });
    }
    movies.get(s.movieId).sessions.push(s);
  }

  container.innerHTML = '';

  for (const [, movie] of movies) {
    const card = document.createElement('div');
    card.className = 'movie-card';

    const posterHTML = movie.poster
      ? `<img class="movie-poster" src="${movie.poster}" alt="${escapeHtml(movie.title)}" loading="lazy">`
      : `<div class="movie-poster movie-poster--placeholder" aria-hidden="true">${getInitials(movie.title)}</div>`;

    const sessionsHTML = movie.sessions
      .map(s => {
        const types = s.type.length ? s.type.join(', ') : 'N/D';
        return `<button class="session-btn" data-session-id="${s.sessionId}" data-movie-id="${s.movieId}" aria-label="Sessão ${s.time}, ${escapeHtml(types)}, ${escapeHtml(movie.title)}">
          <span class="session-time">${s.time}</span>
          <span class="session-meta">${escapeHtml(types)}</span>
        </button>`;
      })
      .join('');

    const duration = movie.sessions[0]?.duration;
    const durationText = duration ? ` · ${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}min` : ''}` : '';

    card.innerHTML = `
      <div class="movie-card__poster">${posterHTML}</div>
      <div class="movie-card__info">
        <div class="movie-card__title">${escapeHtml(movie.title)}</div>
        <div class="movie-card__meta">
          <span class="rating-badge">${escapeHtml(movie.contentRating || 'L')}</span>
          <span class="duration-text">${durationText}</span>
        </div>
        <div class="session-times">${sessionsHTML}</div>
      </div>
    `;

    for (const btn of card.querySelectorAll('.session-btn')) {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.sessionId;
        const session = sessions.find(s => s.sessionId === sid);
        if (session) {
          container.querySelectorAll('.session-btn').forEach(b => b.classList.remove('session-btn--active'));
          btn.classList.add('session-btn--active');
          onSelect(session);
        }
      });
    }

    container.appendChild(card);
  }
}

/**
 * Render the list of compatible next sessions (suggestions).
 */
export function renderNextSessions(container, nextSessions, step, onSelect) {
  if (!nextSessions.length) {
    showEmpty(container, 'Nenhuma sessão compatível encontrada após este filme.', '🚫');
    return;
  }

  container.innerHTML = `<h3 class="section-title">Escolha o ${ordinal(step + 1)}º filme</h3>`;

  for (const s of nextSessions) {
    const card = document.createElement('div');
    card.className = `next-session-card next-session-card--${s.feasibility}`;

    const types = s.type.length ? s.type.join(', ') : '';

    card.innerHTML = `
      <div class="next-session__wait">
        <span class="wait-badge wait-badge--${s.feasibility}">
          <span class="wait-badge__icon" aria-hidden="true">${waitIcon(s.feasibility)}</span>
          ${s.waitFormatted} de espera
        </span>
      </div>
      <div class="next-session__info">
        <div class="next-session__title">${escapeHtml(s.movieTitle)}</div>
        <div class="next-session__meta">
          <span class="session-time">${s.time}</span>
          ${types ? `<span class="session-meta">${escapeHtml(types)}</span>` : ''}
          ${s.room ? `<span class="session-meta">Sala ${escapeHtml(s.room)}</span>` : ''}
        </div>
      </div>
      <button class="add-btn" aria-label="Adicionar ${escapeHtml(s.movieTitle)} às ${s.time}">Adicionar</button>
    `;

    card.querySelector('.add-btn').addEventListener('click', () => onSelect(s));
    container.appendChild(card);
  }
}

/**
 * Render the marathon timeline and summary.
 */
export function renderMarathon(container, marathon, onRemove) {
  if (!marathon || !marathon.items.length) {
    showEmpty(container, 'A maratona aparece aqui conforme você adiciona filmes.', '🍿');
    return;
  }

  const timelineItems = marathon.items
    .map((item, i) => {
      const s = item.session;
      const endTime = addMinutesDisplay(s.time, s.duration);

      const waitBlock = item.waitMinutes > 0
        ? `<div class="timeline-wait">
            <div class="timeline-wait__line"></div>
            <span class="wait-badge wait-badge--${item.feasibility}">
              <span class="wait-badge__icon" aria-hidden="true">${waitIcon(item.feasibility)}</span>
              ${item.waitFormatted} de espera
            </span>
            <div class="timeline-wait__line"></div>
           </div>`
        : '';

      return `
        ${waitBlock}
        <div class="timeline-item" data-index="${i}">
          <div class="timeline-item__number">${i + 1}</div>
          <div class="timeline-item__content">
            <div class="timeline-item__title">${escapeHtml(s.movieTitle)}</div>
            <div class="timeline-item__meta">
              ${s.time} → ${endTime}
              · ${formatDuration(s.duration)}
              ${s.type.length ? `· ${escapeHtml(s.type.join(', '))}` : ''}
            </div>
          </div>
          ${i > 0 ? `<button class="remove-btn" data-index="${i}" title="Remover ${escapeHtml(s.movieTitle)}" aria-label="Remover ${escapeHtml(s.movieTitle)} da maratona">✕</button>` : ''}
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="marathon-panel">
      <h3 class="section-title">Sua Maratona</h3>
      <div class="timeline">${timelineItems}</div>
      <div class="marathon-summary">
        <div class="summary-row">
          <span>Início</span><strong>${marathon.startTime}</strong>
        </div>
        <div class="summary-row">
          <span>Término estimado</span><strong>${marathon.endTime}</strong>
        </div>
        <div class="summary-row">
          <span>Filmes assistidos</span><strong>${marathon.items.length}</strong>
        </div>
        <div class="summary-row">
          <span>Tempo total de filmes</span><strong>${marathon.totalDurationFormatted}</strong>
        </div>
        <div class="summary-row">
          <span>Tempo total de espera</span><strong>${marathon.totalWaitFormatted}</strong>
        </div>
        <div class="summary-row summary-row--total">
          <span>Duração total</span><strong>${marathon.totalElapsedFormatted}</strong>
        </div>
      </div>
      <button class="clear-marathon-btn" data-action="clear">🗑️ Limpar maratona</button>
    </div>
  `;

  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      onRemove(index);
    });
  });

  const clearBtn = container.querySelector('.clear-marathon-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => onRemove(0));
  }
}

// --- Helpers ---

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getInitials(title) {
  return (title || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

function ordinal(n) {
  const suffixes = ['', 'º', 'º', 'º', 'º', 'º', 'º', 'º', 'º', 'º'];
  return `${n}${suffixes[n] || 'º'}`;
}

function formatDuration(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

function addMinutesDisplay(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function waitIcon(feasibility) {
  const icons = { ideal: '⚡', ok: '⏰', long_wait: '⏳' };
  return icons[feasibility] || '⏱️';
}
