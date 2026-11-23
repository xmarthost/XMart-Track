import dayjs from 'dayjs';
import { brand } from '../theme/palette';

// Speeds under this value (knots) are treated as stationary to filter GPS drift.
const MOVING_THRESHOLD_KNOTS = 1.5;

export const stateColors = {
  moving: brand.green,
  static: brand.blue,
  offline: brand.red,
  inactive: '#94A3B8',
};

export const getDeviceState = (device, position) => {
  if (!device || device.status === 'unknown') {
    return 'inactive';
  }
  if (device.status === 'offline') {
    return 'offline';
  }
  if (position) {
    const { motion } = position.attributes || {};
    if (motion === true || (motion === undefined && position.speed > MOVING_THRESHOLD_KNOTS)) {
      return 'moving';
    }
  }
  return 'static';
};

export const formatDurationShort = (milliseconds) => {
  if (milliseconds == null || Number.isNaN(milliseconds) || milliseconds < 0) {
    return '';
  }
  const minutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const sinceNow = (time) => (time ? formatDurationShort(dayjs().diff(dayjs(time))) : '');

export const daysUntil = (time) => (time ? dayjs(time).diff(dayjs(), 'day') : null);
