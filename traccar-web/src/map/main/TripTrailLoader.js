import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { sessionActions } from '../../store';

const MAX_POINTS = 2500;

// The green live line starts where the current trip started (last ACC ON), even when this page
// was not open at that time: the route since then is loaded from the server.
const TripTrailLoader = () => {
  const dispatch = useDispatch();
  const selectedId = useSelector((state) => state.devices.selectedId);

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const now = dayjs();
        const query = new URLSearchParams({
          deviceId: selectedId,
          from: now.subtract(1, 'day').toISOString(),
          to: now.toISOString(),
        });
        query.append('type', 'ignitionOn');
        query.append('type', 'ignitionOff');
        const eventsResponse = await fetch(`api/reports/events?${query}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!eventsResponse.ok) return;
        const events = await eventsResponse.json();
        const last = events.sort(
          (a, b) => dayjs(b.eventTime).valueOf() - dayjs(a.eventTime).valueOf(),
        )[0];
        if (!last || last.type !== 'ignitionOn') return;
        const routeQuery = new URLSearchParams({
          deviceId: selectedId,
          from: dayjs(last.eventTime).toISOString(),
          to: now.toISOString(),
        });
        const routeResponse = await fetch(`api/reports/route?${routeQuery}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!routeResponse.ok) return;
        const route = await routeResponse.json();
        if (!route.length) return;
        const step = Math.ceil(route.length / MAX_POINTS);
        const points = route
          .filter((_, index) => index % step === 0 || index === route.length - 1)
          .map((p) => [p.longitude, p.latitude]);
        dispatch(sessionActions.setHistory({ deviceId: selectedId, points }));
      } catch {
        // keep the live line
      }
    })();
    return () => controller.abort();
  }, [selectedId, dispatch]);

  // a new trip starts a new line
  const latestEvent = useSelector((state) => state.events.items[0]);
  useEffect(() => {
    if (latestEvent?.type === 'ignitionOn') {
      dispatch(sessionActions.setHistory({ deviceId: latestEvent.deviceId, points: [] }));
    }
  }, [latestEvent, dispatch]);

  return null;
};

export default TripTrailLoader;
