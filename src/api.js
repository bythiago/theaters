const BASE_URL = window.location.origin;

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

async function fetchJSON(url, retries = 2) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache.set(url, { data, ts: Date.now() });
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

export async function getTheaters() {
  return fetchJSON(`${BASE_URL}/theaters`);
}

export async function getTheatersByCity(cityId) {
  return fetchJSON(`${BASE_URL}/theaters/city/${cityId}`);
}

export async function getSessions(cityId, theaterId) {
  return fetchJSON(`${BASE_URL}/sessions/city/${cityId}/theater/${theaterId}`);
}
