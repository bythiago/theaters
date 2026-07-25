/**
 * Convert "HH:MM" to total minutes from midnight.
 * Handles sessions after midnight (e.g. "00:30" treated as 1470 if needed).
 */
export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function addMinutesToTime(time, minutes) {
  const total = timeToMinutes(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Flatten the API 4 response into a list of session objects.
 * Each item contains movie info + session info for easy processing.
 *
 * @param {Array} dateGroups - Raw API response array (grouped by date)
 * @param {string} selectedDate - "YYYY-MM-DD" to filter (optional)
 * @returns {Array} flat session list
 */
export function flattenSessions(dateGroups, selectedDate = null) {
  const flat = [];

  for (const group of dateGroups) {
    const date = group.date || group.localDate?.substring(0, 10);
    if (selectedDate && date !== selectedDate) continue;

    for (const movie of (group.movies || [])) {
      const duration = parseInt(movie.duration, 10) || 0;

      for (const room of (movie.rooms || [])) {
        for (const session of (room.sessions || [])) {
          if (!session.enabled) continue;
          if (!session.time) continue;

          const startMinutes = timeToMinutes(session.time);

          flat.push({
            movieId: movie.id,
            movieTitle: movie.title,
            duration,
            contentRating: movie.contentRating,
            poster: (movie.images || []).find(i => i.type === 'PosterPortrait')?.url
                  || (movie.images || []).find(i => i.type === 'PosterHorizontal')?.url
                  || movie.posterMedium || movie.poster || null,
            time: session.time,
            startMinutes,
            endMinutes: startMinutes + duration,
            room: room.name || session.room || '',
            type: session.type || [],
            date,
            sessionId: session.id,
          });
        }
      }
    }
  }

  return flat.sort((a, b) => a.startMinutes - b.startMinutes);
}

/**
 * Find all sessions that can follow a given session.
 *
 * @param {Object} current - A flat session object (result of flattenSessions)
 * @param {Array} allSessions - All flat sessions for the same day
 * @param {Object} opts
 * @param {number} opts.minWait - Minimum wait in minutes (default 15)
 * @param {number} opts.maxWait - Maximum wait in minutes (default 180)
 * @returns {Array} Candidate sessions with wait info, sorted by wait time
 */
export function findNextSessions(current, allSessions, { minWait = 15, maxWait = 180 } = {}) {
  const results = [];

  for (const candidate of allSessions) {
    // Can't be the same session
    if (candidate.sessionId === current.sessionId) continue;

    const waitMinutes = candidate.startMinutes - current.endMinutes;

    if (waitMinutes < minWait) continue;
    if (waitMinutes > maxWait) continue;

    let feasibility;
    if (waitMinutes <= 60) feasibility = 'ideal';
    else if (waitMinutes <= 120) feasibility = 'ok';
    else feasibility = 'long_wait';

    results.push({
      ...candidate,
      waitMinutes,
      waitFormatted: formatMinutes(waitMinutes),
      feasibility,
    });
  }

  return results.sort((a, b) => a.waitMinutes - b.waitMinutes);
}

/**
 * Build a complete marathon summary from an ordered list of selected sessions.
 *
 * @param {Array} selectedSessions - Ordered flat session objects
 * @returns {Object} Marathon summary
 */
export function buildMarathon(selectedSessions) {
  if (!selectedSessions.length) return null;

  const first = selectedSessions[0];
  const last = selectedSessions[selectedSessions.length - 1];

  let totalDuration = 0;
  let totalWait = 0;
  const items = [];

  for (let i = 0; i < selectedSessions.length; i++) {
    const s = selectedSessions[i];
    totalDuration += s.duration;

    let waitMinutes = 0;
    let waitFormatted = null;
    let feasibility = null;

    if (i > 0) {
      const prev = selectedSessions[i - 1];
      waitMinutes = s.startMinutes - prev.endMinutes;
      waitFormatted = formatMinutes(waitMinutes);
      totalWait += waitMinutes;

      if (waitMinutes <= 60) feasibility = 'ideal';
      else if (waitMinutes <= 120) feasibility = 'ok';
      else feasibility = 'long_wait';
    }

    items.push({
      session: s,
      waitMinutes,
      waitFormatted,
      feasibility,
    });
  }

  const endMinutes = last.endMinutes;
  const endTime = addMinutesToTime('00:00', endMinutes);

  return {
    items,
    totalDuration,
    totalDurationFormatted: formatMinutes(totalDuration),
    totalWait,
    totalWaitFormatted: formatMinutes(totalWait),
    startTime: first.time,
    endTime,
    totalElapsed: endMinutes - first.startMinutes,
    totalElapsedFormatted: formatMinutes(endMinutes - first.startMinutes),
  };
}

/**
 * Group sessions by movieId.
 * @param {Array} sessions - Flat session list from flattenSessions()
 * @returns {Map<string, Array>} Map of movieId -> session[]
 */
export function groupByMovieId(sessions) {
  const map = new Map();
  for (const s of sessions) {
    if (!map.has(s.movieId)) {
      map.set(s.movieId, []);
    }
    map.get(s.movieId).push(s);
  }
  return map;
}

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick random movies and build a valid chronological marathon.
 *
 * @param {Array} sessions - Flat session list from flattenSessions()
 * @param {number} count - Number of unique movies to pick
 * @param {Object} opts
 * @param {number} opts.minWait - Minimum wait between movies in minutes (default 15)
 * @param {number} opts.maxWait - Maximum wait between movies in minutes (default 180)
 * @returns {Object|null} { sessions: Array, uniqueMovies: number, clamped: boolean }
 *          or null if fewer than 2 sessions could be placed
 */
export function pickRandomMarathon(sessions, count, { minWait = 15, maxWait = 180 } = {}) {
  const movieMap = groupByMovieId(sessions);
  const movieIds = [...movieMap.keys()];
  const uniqueMovies = movieIds.length;

  if (uniqueMovies < 2) return null;

  const clamped = count > uniqueMovies;
  const actualCount = Math.min(count, uniqueMovies);

  shuffle(movieIds);
  const pickedIds = movieIds.slice(0, actualCount);

  const pickedMovies = pickedIds.map(id => ({
    id,
    sessions: movieMap.get(id).sort((a, b) => a.startMinutes - b.startMinutes),
  }));

  pickedMovies.sort((a, b) => a.sessions[0].startMinutes - b.sessions[0].startMinutes);

  const placed = [];
  for (const movie of pickedMovies) {
    let bestSession = null;

    if (placed.length === 0) {
      bestSession = movie.sessions[0];
    } else {
      const prev = placed[placed.length - 1];
      for (const candidate of movie.sessions) {
        const wait = candidate.startMinutes - prev.endMinutes;
        if (wait >= minWait && wait <= maxWait) {
          bestSession = candidate;
          break;
        }
      }
    }

    if (bestSession) {
      placed.push(bestSession);
    }
  }

  if (placed.length < 2) return null;

  return { sessions: placed, uniqueMovies, clamped };
}
