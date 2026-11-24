import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, socketUrl } from '../api/server';
import { logInfo, logWarn } from './log';
import { handleNotificationTaps, promptSetupOnce, registerPush } from './push';

const AppContext = createContext(null);
const TRAIL_LENGTH = 300;

// speed is in knots; 2 knots = 3.7 km/h
const isTrailPoint = (p) =>
  p.valid !== false &&
  p.attributes?.ignition !== false &&
  (p.attributes?.sat ?? 1) > 0 &&
  (p.speed > 2 || p.attributes?.motion === true);

// the green line is removed this long after ACC OFF; a new ACC ON always starts a new line
const TRAIL_CLEAR_AFTER_OFF_MS = 12000;

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState({});
  const [positions, setPositions] = useState({});
  const [events, setEvents] = useState([]);
  const [trails, setTrails] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const ignitionRef = useRef({});
  const clearTimersRef = useRef({});

  const applyPositions = useCallback((items) => {
    // ACC changes: OFF -> clear the line after a few seconds, ON -> start a new line (new journey)
    const newJourney = new Set();
    items.forEach((p) => {
      const ignition = p.attributes?.ignition;
      if (typeof ignition !== 'boolean') return;
      const id = p.deviceId;
      const before = ignitionRef.current[id];
      ignitionRef.current[id] = ignition;
      if (ignition && before === false) {
        clearTimeout(clearTimersRef.current[id]);
        newJourney.add(id);
      } else if (!ignition && before !== false) {
        clearTimeout(clearTimersRef.current[id]);
        clearTimersRef.current[id] = setTimeout(() => {
          setTrails((previous) => {
            if (!previous[id]) return previous;
            const next = { ...previous };
            delete next[id];
            return next;
          });
        }, TRAIL_CLEAR_AFTER_OFF_MS);
      }
    });
    setPositions((previous) => {
      const next = { ...previous };
      items.forEach((p) => {
        next[p.deviceId] = p;
      });
      return next;
    });
    setTrails((previous) => {
      const next = { ...previous };
      newJourney.forEach((id) => delete next[id]);
      items.forEach((p) => {
        // Only real GPS fixes while driving extend the line: a fix without satellites (valid false)
        // or a jump while parked would draw a stray line on the map.
        if (!isTrailPoint(p)) return;
        const trail = next[p.deviceId] || [];
        const last = trail[trail.length - 1];
        if (!last || last.latitude !== p.latitude || last.longitude !== p.longitude) {
          next[p.deviceId] = [...trail, { latitude: p.latitude, longitude: p.longitude }].slice(
            -TRAIL_LENGTH,
          );
        }
      });
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const [deviceList, positionList] = await Promise.all([api('api/devices'), api('api/positions')]);
    setDevices(Object.fromEntries(deviceList.map((d) => [d.id, d])));
    applyPositions(positionList);
  }, [applyPositions]);

  // live updates over the websocket, plus a 10 second refresh as a safety net
  useEffect(() => {
    if (!user) return undefined;
    let closed = false;
    let retry;
    let attempts = 0;
    const connect = () => {
      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      let keepAlive;
      socket.onopen = () => {
        logInfo('socket', 'connected');
        setConnected(true);
        attempts = 0;
        // mobile networks drop idle connections; the server ignores this small message
        keepAlive = setInterval(() => {
          if (socket.readyState === 1) socket.send('{}');
        }, 20000);
      };
      socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.devices) {
          setDevices((previous) => {
            const next = { ...previous };
            data.devices.forEach((d) => {
              next[d.id] = d;
            });
            return next;
          });
        }
        if (data.positions) applyPositions(data.positions);
        if (data.events) setEvents((previous) => [...data.events, ...previous].slice(0, 100));
      };
      socket.onclose = (event) => {
        logWarn('socket', `closed code ${event?.code ?? '?'} ${event?.reason || ''}`);
        clearInterval(keepAlive);
        setConnected(false);
        attempts += 1;
        if (!closed) retry = setTimeout(connect, Math.min(1000 * attempts, 10000));
      };
      socket.onerror = (event) => {
        logWarn('socket', 'error', event?.message || '');
        socket.close();
      };
    };
    refresh().catch(() => {});
    connect();
    const timer = setInterval(() => {
      api('api/positions').then(applyPositions).catch(() => {});
    }, 10000);
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(timer);
      socketRef.current?.close();
    };
    // reconnect only when a different user signs in, not when the user's attributes change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refresh, applyPositions]);

  // push notifications: register this phone once per sign-in, open the vehicle on tap
  useEffect(() => {
    if (!user) return undefined;
    // push only when the server has Firebase switched on
    api('api/notifications/notificators')
      .then((list) => {
        if (!list.some((n) => n.type === 'firebase')) return;
        registerPush(user).then((updated) => {
          if (updated) setUser(updated);
          promptSetupOnce();
        });
      })
      .catch(() => {});
    return handleNotificationTaps(setSelectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = {
    user,
    setUser,
    devices,
    positions,
    events,
    trails,
    selectedId,
    setSelectedId,
    connected,
    refresh,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
