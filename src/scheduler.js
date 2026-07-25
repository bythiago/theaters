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
