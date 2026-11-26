import { useEffect, useRef, useState } from 'react';
import { distanceM } from './roadMatch';

// Smooth car movement like ride-hailing and delivery apps: the tracker sends a fix every few
// seconds; instead of jumping, the car glides from where it is to the new fix in the same time the
// fix took to arrive (shown one update behind, so it never has to guess ahead). The camera uses the
// same duration and a linear easing, so a followed car stays centered.
const MIN_MS = 800;
const MAX_MS = 8000;
const FIRST_MS = 1500;
const JUMP_M = 2000; // farther than this: no animation (new trip, GPS jump)
const FRAME_MS = 50; // about 20 frames per second

const timing = new Map(); // id -> { key, at, duration }

// How long the move to this fix should take; the same answer for the map and the camera.
export function moveDuration(id, latitude, longitude) {
  const key = `${latitude}:${longitude}`;
  const known = timing.get(id);
  if (known?.key === key) return known.duration;
  const now = Date.now();
  const duration = known ? Math.min(MAX_MS, Math.max(MIN_MS, now - known.at)) : FIRST_MS;
  timing.set(id, { key, at: now, duration });
  return duration;
}

const turn = (from, to) => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180; // shortest way round
  return delta;
};

// cars: [{ id, latitude, longitude, course, state }] -> same list with animated positions
export function useSmoothCars(cars, enabled = true) {
  const [frame, setFrame] = useState(0);
  const anim = useRef({}); // id -> { from, to, fromCourse, toCourse, start, duration }

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    cars.forEach((car) => {
      const target = [car.longitude, car.latitude];
      const a = anim.current[car.id];
      if (a && a.to[0] === target[0] && a.to[1] === target[1]) return;
      const duration = moveDuration(car.id, car.latitude, car.longitude);
      const current = a ? position(a, now) : null;
      if (!current || distanceM(current.coords, target) > JUMP_M) {
        anim.current[car.id] = { from: target, to: target, fromCourse: car.course || 0, toCourse: car.course || 0, start: now, duration: 1 };
      } else {
        anim.current[car.id] = {
          from: current.coords,
          to: target,
          fromCourse: current.course,
          toCourse: distanceM(current.coords, target) > 3 ? car.course || current.course : current.course,
          start: now,
          duration,
        };
      }
    });
    const ids = new Set(cars.map((c) => c.id));
    Object.keys(anim.current).forEach((id) => !ids.has(Number(id)) && delete anim.current[id]);
  }, [cars, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      if (Object.values(anim.current).some((a) => now - a.start < a.duration + FRAME_MS)) setFrame((f) => f + 1);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled) return cars;
  const now = Date.now();
  return cars.map((car) => {
    const a = anim.current[car.id];
    if (!a) return car;
    const p = position(a, now);
    return { ...car, longitude: p.coords[0], latitude: p.coords[1], course: p.course, frame };
  });
}

function position(a, now) {
  const t = Math.min(1, Math.max(0, (now - a.start) / a.duration));
  return {
    coords: [a.from[0] + (a.to[0] - a.from[0]) * t, a.from[1] + (a.to[1] - a.from[1]) * t],
    course: (a.fromCourse + turn(a.fromCourse, a.toCourse) * Math.min(1, t * 3) + 360) % 360,
  };
}
