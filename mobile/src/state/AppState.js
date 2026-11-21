import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, socketUrl } from '../api/server';
import { logInfo, logWarn } from './log';
import { handleNotificationTaps, promptSetupOnce, registerPush } from './push';

const AppContext = createContext(null);
const TRAIL_LENGTH = 3000;
const toPoint = (p) => ({ latitude: p.latitude, longitude: p.longitude, time: p.fixTime });

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState({});
  const [positions, setPositions] = useState({});
  const [events, setEvents] = useState([]);
  const [trails, setTrails] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const applyPositions = useCallback((items) => {
    setPositions((previous) => {
      const next = { ...previous };
      items.forEach((p) => {
        next[p.deviceId] = p;
      });
      return next;
    });
    setTrails((previous) => {
      const next = { ...previous };
      items.forEach((p) => {
        const trail = next[p.deviceId] || [];
        const last = trail[trail.length - 1];
        if (!last || last.latitude !== p.latitude || last.longitude !== p.longitude) {
          next[p.deviceId] = [...trail, toPoint(p)].slice(-TRAIL_LENGTH);
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
    registerPush(user).then((updated) => {
      if (updated) setUser(updated);
      promptSetupOnce();
    });
    return handleNotificationTaps(setSelectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // The green line starts where the current trip started (last ACC ON), even if the app was
  // closed then: the route since that moment is loaded from the server.
  const loadTrail = useCallback(async (deviceId) => {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      const acc = await api(
        `api/reports/events?deviceId=${deviceId}&type=ignitionOn&type=ignitionOff&from=${from}&to=${now.toISOString()}`,
      );
      const last = acc.sort((a, b) => new Date(b.eventTime) - new Date(a.eventTime))[0];
      if (!last || last.type !== 'ignitionOn') return;
      const route = await api(
        `api/reports/route?deviceId=${deviceId}&from=${new Date(last.eventTime).toISOString()}&to=${now.toISOString()}`,
        { timeout: 20000 },
      );
      if (!route.length) return;
      const step = Math.ceil(route.length / TRAIL_LENGTH);
      const points = route.filter((_, index) => index % step === 0 || index === route.length - 1).map(toPoint);
      const end = new Date(route[route.length - 1].fixTime).getTime();
      setTrails((previous) => {
        // keep live points that arrived after the loaded route
        const live = (previous[deviceId] || []).filter((p) => p.time && new Date(p.time).getTime() > end);
        return { ...previous, [deviceId]: [...points, ...live].slice(-TRAIL_LENGTH) };
      });
      logInfo('trail', `loaded ${points.length} points since ACC ON`);
    } catch (error) {
      logWarn('trail', 'could not load trip route', error);
    }
  }, []);

  useEffect(() => {
    if (user && selectedId) loadTrail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedId, loadTrail]);

  // a new trip starts a new line
  useEffect(() => {
    const start = events[0];
    if (start?.type !== 'ignitionOn') return;
    setTrails((previous) => {
      const current = positions[start.deviceId];
      return { ...previous, [start.deviceId]: current ? [toPoint(current)] : [] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

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
