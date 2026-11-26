import { useEffect, useMemo, useRef, useState } from 'react';
import { logWarn } from '../state/log';

// Snaps the green trail to the roads ("map matching") with the OSRM match service, so the line
// follows the streets instead of cutting straight across blocks between two GPS fixes.
// OSRM finds the most likely road path through the GPS points (Hidden Markov Model matching).
// The public OSRM server is used; it allows light use (about 1 request per second), so points are
// thinned, sent in chunks and cached, and the raw line is shown whenever matching is not possible.
const OSRM = 'https://router.project-osrm.org';
const CHUNK = 50; // coordinates per request (the public server allows up to 100)
const MIN_GAP_M = 15; // points closer than this add nothing to the matching
const RADIUS_M = 25; // GPS accuracy (1 standard deviation) used by OSRM
const RETRY_LAST_MS = 10000; // the growing last chunk is matched again at most this often
const REQUEST_SPACING_MS = 1100;

const cache = new Map(); // chunk key -> [[lon, lat], ...] (matched) or null (failed)
let queue = Promise.resolve();
let lastRequest = 0;

export const distanceM = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

const lineLength = (coords) => coords.reduce((sum, c, i) => (i ? sum + distanceM(coords[i - 1], c) : 0), 0);

const thin = (coords) => {
  const out = [];
  coords.forEach((c, i) => {
    if (!out.length || i === coords.length - 1 || distanceM(out[out.length - 1], c) >= MIN_GAP_M) out.push(c);
  });
  return out;
};

const keyOf = (chunk) => `${chunk.length}|${chunk[0].join(',')}|${chunk[chunk.length - 1].join(',')}`;

async function requestMatch(chunk) {
  const wait = lastRequest + REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const path = chunk.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const radiuses = chunk.map(() => RADIUS_M).join(';');
  const url = `${OSRM}/match/v1/driving/${path}?geometries=geojson&overview=full&tidy=true&gaps=ignore&radiuses=${radiuses}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const json = await response.json();
    if (json.code !== 'Ok' || !json.matchings?.length) throw new Error(json.code || `HTTP ${response.status}`);
    const matched = json.matchings.flatMap((m) => m.geometry.coordinates);
    // a matched path much longer than the GPS track means a wrong detour: keep the GPS line
    const raw = lineLength(chunk);
    if (raw > 50 && lineLength(matched) > raw * 1.6 + 200) throw new Error('detour');
    return matched;
  } finally {
    clearTimeout(timer);
  }
}

const enqueue = (chunk) => {
  const run = queue.then(() => requestMatch(chunk));
  queue = run.catch(() => {});
  return run;
};

// points: [{ latitude, longitude }] -> [[lon, lat], ...] following the roads where possible
export function useMatchedTrail(points) {
  const [version, setVersion] = useState(0);
  const lastTry = useRef({});
  const coords = useMemo(() => thin((points || []).map((p) => [p.longitude, p.latitude])), [points]);

  // chunks overlap by one point so the pieces join
  const chunks = useMemo(() => {
    const list = [];
    for (let start = 0; start < coords.length - 1; start += CHUNK - 1) list.push(coords.slice(start, start + CHUNK));
    return list;
  }, [coords]);

  useEffect(() => {
    let alive = true;
    chunks.forEach((chunk, index) => {
      const key = keyOf(chunk);
      if (cache.has(key) || chunk.length < 2) return;
      const isLast = index === chunks.length - 1;
      if (isLast && Date.now() - (lastTry.current.last || 0) < RETRY_LAST_MS) return;
      if (isLast) lastTry.current.last = Date.now();
      cache.set(key, undefined); // in progress
      enqueue(chunk)
        .then((matched) => cache.set(key, matched))
        .catch((error) => {
          cache.set(key, null);
          logWarn('match', `road matching failed (${error.message || error}), showing the GPS line`);
        })
        .finally(() => alive && setVersion((v) => v + 1));
    });
    return () => {
      alive = false;
    };
  }, [chunks]);

  return useMemo(() => {
    if (coords.length < 2) return coords;
    const out = [];
    chunks.forEach((chunk) => {
      const matched = cache.get(keyOf(chunk)) || chunk;
      out.push(...(out.length ? matched.slice(1) : matched));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, coords, version]);
}

// Cuts the line where the (smoothly moving) car is, so the line ends under the car and never runs
// ahead of it.
export function trimLineToCar(line, car) {
  if (!car || line.length < 2) return line;
  let best = { d: Infinity, i: line.length - 1 };
  const kx = Math.cos((car[1] * Math.PI) / 180);
  for (let i = Math.max(0, line.length - 60); i < line.length - 1; i += 1) {
    const [ax, ay] = [line[i][0] * kx, line[i][1]];
    const [bx, by] = [line[i + 1][0] * kx, line[i + 1][1]];
    const [px, py] = [car[0] * kx, car[1]];
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    const d = (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2;
    if (d < best.d) best = { d, i };
  }
  // far from the line (e.g. just after a jump): simply continue the line to the car
  const near = distanceM(line[best.i], car) < 150 || distanceM(line[best.i + 1] || line[best.i], car) < 150;
  return near ? [...line.slice(0, best.i + 1), car] : [...line, car];
}
