import { iconColors, vehicleImages, vehicleTypes } from '../map/vehicleIcons';

// Which icon a vehicle shows: its type (device attribute xm.icon, default car) in its own colour
// (xm.iconColor), or by default in the colour of its state (green moving, blue parked, red offline).
export const ICON_KEY = 'xm.icon';
export const ICON_COLOR_KEY = 'xm.iconColor';
export const STATUS_COLOR = 'status';

const stateColor = { moving: 'green', static: 'blue', offline: 'red', inactive: 'gray' };
export const fixedColors = Object.keys(iconColors).filter((c) => c !== 'gray');

export function vehicleIcon(device, state) {
  const type = vehicleTypes.some((t) => t.key === device?.attributes?.[ICON_KEY]) ? device.attributes[ICON_KEY] : 'sedan';
  const chosen = device?.attributes?.[ICON_COLOR_KEY];
  const fixed = chosen && chosen !== STATUS_COLOR && iconColors[chosen];
  const color = fixed ? chosen : stateColor[state] || 'gray';
  // with a fixed colour the state still shows: offline / inactive vehicles are faded
  const opacity = fixed && (state === 'offline' || state === 'inactive') ? 0.5 : 1;
  return { key: `${type}-${color}`, image: vehicleImages[`${type}-${color}`], opacity };
}

export { iconColors, vehicleImages, vehicleTypes };
