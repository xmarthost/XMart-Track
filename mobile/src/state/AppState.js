import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, socketUrl } from '../api/server';
import { logInfo, logWarn } from './log';

const AppContext = createContext(null);
const TRAIL_LENGTH = 300;

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
    const connect = () => {
      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      socket.onopen = () => {
        logInfo('socket', 'connected');
        setConnected(true);
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
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 5000);
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
  }, [user, refresh, applyPositions]);

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
