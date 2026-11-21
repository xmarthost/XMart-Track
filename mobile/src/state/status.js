export const colors = {
  teal: '#007080',
  tealDark: '#0A4A55',
  background: '#F4F8FD',
  text: '#0F172A',
  muted: '#475569',
  border: '#E2E8F0',
  moving: '#16A34A',
  static: '#2563EB',
  offline: '#DC2626',
  inactive: '#94A3B8',
  amber: '#F59E0B',
};

export const carImages = {
  moving: require('../../assets/cars/car-moving.png'),
  static: require('../../assets/cars/car-static.png'),
  offline: require('../../assets/cars/car-offline.png'),
  inactive: require('../../assets/cars/car-inactive.png'),
};

export const getState = (device, position) => {
  if (!device || device.status === 'unknown') return 'inactive';
  if (device.status === 'offline') return 'offline';
  const motion = position?.attributes?.motion;
  if (motion === true || (motion === undefined && position?.speed > 1.5)) return 'moving';
  return 'static';
};

export const kmh = (knots) => Math.round((knots || 0) * 1.852);

export const duration = (ms) => {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes % 60}m`;
};

export const since = (time) => (time ? duration(Date.now() - new Date(time).getTime()) : '');

const pad = (n) => String(n).padStart(2, '0');
export const formatDateTime = (time, seconds = true) => {
  if (!time) return '--';
  const d = new Date(time);
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return seconds ? `${base}:${pad(d.getSeconds())}` : base;
};

export const eventLabels = {
  ignitionOn: 'Ignition on',
  ignitionOff: 'Ignition off',
  deviceOnline: 'Online',
  deviceOffline: 'Offline',
  deviceMoving: 'Moving',
  deviceStopped: 'Stopped',
  deviceOverspeed: 'Overspeed',
  geofenceEnter: 'Geofence enter',
  geofenceExit: 'Geofence exit',
  alarm: 'Alarm',
  commandResult: 'Command reply',
};
