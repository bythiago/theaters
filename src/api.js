const BASE_URL = 'http://localhost:8080';

const cache = new Map();

async function fetchJSON(url) {
  if (cache.has(url)) return cache.get(url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const data = await res.json();
  cache.set(url, data);
  return data;
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
