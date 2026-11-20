import { grey } from '@mui/material/colors';
import { createTheme } from '@mui/material';
import { loadImage, prepareIcon } from './mapUtil';

import directionSvg from '../../resources/images/direction.svg';
import backgroundSvg from '../../resources/images/background.svg';
import animalSvg from '@material-symbols/svg-600/outlined/pets.svg';
import bicycleSvg from '@material-symbols/svg-600/outlined/directions_bike.svg';
import boatSvg from '@material-symbols/svg-600/outlined/sailing.svg';
import busSvg from '@material-symbols/svg-600/outlined/directions_bus.svg';
import carSvg from '@material-symbols/svg-600/outlined/directions_car.svg';
import camperSvg from '@material-symbols/svg-600/outlined/rv_hookup.svg';
import craneSvg from '@material-symbols/svg-600/outlined/precision_manufacturing.svg';
import defaultSvg from '@material-symbols/svg-600/outlined/location_on.svg';
import startSvg from '@material-symbols/svg-600/outlined/play_circle.svg';
import finishSvg from '@material-symbols/svg-600/outlined/stop_circle.svg';
import helicopterSvg from '@material-symbols/svg-600/outlined/helicopter.svg';
import motorcycleSvg from '@material-symbols/svg-600/outlined/motorcycle.svg';
import personSvg from '@material-symbols/svg-600/outlined/person.svg';
import planeSvg from '@material-symbols/svg-600/outlined/flight.svg';
import scooterSvg from '@material-symbols/svg-600/outlined/moped.svg';
import shipSvg from '@material-symbols/svg-600/outlined/directions_boat.svg';
import tractorSvg from '@material-symbols/svg-600/outlined/agriculture.svg';
import trailerSvg from '@material-symbols/svg-600/outlined/auto_towing.svg';
import trainSvg from '@material-symbols/svg-600/outlined/train.svg';
import tramSvg from '@material-symbols/svg-600/outlined/tram.svg';
import truckSvg from '@material-symbols/svg-600/outlined/local_shipping.svg';
import vanSvg from '@material-symbols/svg-600/outlined/airport_shuttle.svg';

import warningSvg from '@material-symbols/svg-600/outlined/warning.svg';
import taskAltSvg from '@material-symbols/svg-600/outlined/task_alt.svg';
import arrowCircleDownSvg from '@material-symbols/svg-600/outlined/arrow_circle_down.svg';
import arrowCircleUpSvg from '@material-symbols/svg-600/outlined/arrow_circle_up.svg';
import bedtimeSvg from '@material-symbols/svg-600/outlined/bedtime.svg';
import cloudOffSvg from '@material-symbols/svg-600/outlined/cloud_off.svg';
import cloudDoneSvg from '@material-symbols/svg-600/outlined/cloud_done.svg';
import speedSvg from '@material-symbols/svg-600/outlined/speed.svg';
import cloudAlertSvg from '@material-symbols/svg-600/outlined/cloud_alert.svg';
import distanceSvg from '@material-symbols/svg-600/outlined/distance.svg';
import powerOffSvg from '@material-symbols/svg-600/outlined/power_off.svg';
import powerSvg from '@material-symbols/svg-600/outlined/power.svg';
import buildSvg from '@material-symbols/svg-600/outlined/build.svg';
import imageSvg from '@material-symbols/svg-600/outlined/image.svg';
import connectWithoutContactSvg from '@material-symbols/svg-600/outlined/connect_without_contact.svg';
import smsSvg from '@material-symbols/svg-600/outlined/sms.svg';

export const mapIcons = {
  animal: animalSvg,
  bicycle: bicycleSvg,
  boat: boatSvg,
  bus: busSvg,
  car: carSvg,
  camper: camperSvg,
  crane: craneSvg,
  default: defaultSvg,
  finish: finishSvg,
  helicopter: helicopterSvg,
  motorcycle: motorcycleSvg,
  person: personSvg,
  plane: planeSvg,
  scooter: scooterSvg,
  ship: shipSvg,
  start: startSvg,
  tractor: tractorSvg,
  trailer: trailerSvg,
  train: trainSvg,
  tram: tramSvg,
  truck: truckSvg,
  van: vanSvg,
};

export const mapIconKey = (category) => {
  switch (category) {
    case 'offroad':
    case 'pickup':
      return 'car';
    case 'trolleybus':
      return 'bus';
    default:
      return mapIcons.hasOwnProperty(category) ? category : 'default';
  }
};

export const eventIcons = {
  alarm: warningSvg,
  commandResult: taskAltSvg,
  deviceFuelDrop: arrowCircleDownSvg,
  deviceFuelIncrease: arrowCircleUpSvg,
  deviceInactive: bedtimeSvg,
  deviceMoving: startSvg,
  deviceOffline: cloudOffSvg,
  deviceOnline: cloudDoneSvg,
  deviceOverspeed: speedSvg,
  deviceStopped: finishSvg,
  deviceUnknown: cloudAlertSvg,
  driverChanged: personSvg,
  geofenceCrossed: distanceSvg,
  geofenceEnter: distanceSvg,
  geofenceExit: distanceSvg,
  ignitionOff: powerOffSvg,
  ignitionOn: powerSvg,
  maintenance: buildSvg,
  media: imageSvg,
  proximityEnter: connectWithoutContactSvg,
  proximityExit: connectWithoutContactSvg,
  queuedCommandSent: taskAltSvg,
  textMessage: smsSvg,
  unaccompaniedMotion: connectWithoutContactSvg,
};

export const eventIconKey = (type) => (eventIcons.hasOwnProperty(type) ? type : 'alarm');

export const mapImages = {};

// XMart: top-view car marker, rotated by course on the map
export const carColors = {
  moving: ['#22C55E', '#15803D'],
  static: ['#16A34A', '#166534'],
  offline: ['#EF4444', '#991B1B'],
  inactive: ['#94A3B8', '#475569'],
};

// Rendered at the screen's pixel density so the marker stays sharp on phones.
const xmCarSvg = ([light, dark]) => {
  const size = Math.round(48 * (window.devicePixelRatio || 1));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 48 48'>
<defs>
<linearGradient id='b' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='${dark}'/><stop offset='0.5' stop-color='${light}'/><stop offset='1' stop-color='${dark}'/></linearGradient>
<linearGradient id='g' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#1e293b'/><stop offset='1' stop-color='#475569'/></linearGradient>
</defs>
<ellipse cx='24' cy='44' rx='11' ry='2.6' fill='rgba(0,0,0,0.25)'/>
<rect x='11.2' y='12' width='3' height='6' rx='1.2' fill='#111827'/>
<rect x='33.8' y='12' width='3' height='6' rx='1.2' fill='#111827'/>
<rect x='11.2' y='31' width='3' height='6' rx='1.2' fill='#111827'/>
<rect x='33.8' y='31' width='3' height='6' rx='1.2' fill='#111827'/>
<path d='M24 3.5 C30.5 3.5 34 6.5 34 12 L34 37 C34 41.5 31 44 24 44 C17 44 14 41.5 14 37 L14 12 C14 6.5 17.5 3.5 24 3.5 Z' fill='url(#b)' stroke='#ffffff' stroke-width='1.6'/>
<path d='M16.8 15.5 Q24 11.5 31.2 15.5 L29.6 21.5 Q24 19.8 18.4 21.5 Z' fill='url(#g)'/>
<rect x='18.3' y='22.4' width='11.4' height='9.6' rx='2' fill='${dark}' opacity='0.55'/>
<path d='M18.4 33 Q24 34.8 29.6 33 L30.6 38.4 Q24 40.2 17.4 38.4 Z' fill='url(#g)' opacity='0.9'/>
<path d='M14 17 L11.5 18.6 L14 19.4 Z M34 17 L36.5 18.6 L34 19.4 Z' fill='${dark}'/>
<rect x='16.3' y='5.4' width='4.2' height='2.2' rx='1' fill='#fef9c3'/>
<rect x='27.5' y='5.4' width='4.2' height='2.2' rx='1' fill='#fef9c3'/>
<rect x='16.8' y='41.2' width='3.6' height='1.6' rx='0.8' fill='#f87171'/>
<rect x='27.6' y='41.2' width='3.6' height='1.6' rx='0.8' fill='#f87171'/>
</svg>`)}`;
};

const theme = createTheme({
  palette: {
    neutral: { main: grey[500] },
  },
});

export default async () => {
  const background = await loadImage(backgroundSvg);
  mapImages.background = await prepareIcon(background);
  mapImages.direction = await prepareIcon(await loadImage(directionSvg));
  await Promise.all(
    Object.entries(carColors).map(async ([state, color]) => {
      mapImages[`xmcar-${state}`] = prepareIcon(null, await loadImage(xmCarSvg(color)));
    }),
  );
  await Promise.all(
    Object.keys(mapIcons).map(async (key) => {
      const results = [];
      ['info', 'success', 'error', 'neutral'].forEach((color) => {
        results.push(
          loadImage(mapIcons[key]).then((icon) => {
            mapImages[`${key}-${color}`] = prepareIcon(background, icon, theme.palette[color].main);
          }),
        );
      });
      await Promise.all(results);
    }),
  );
  await Promise.all(
    Object.keys(eventIcons).map((key) =>
      loadImage(eventIcons[key]).then((icon) => {
        mapImages[key] = prepareIcon(background, icon, theme.palette.neutral.main);
      }),
    ),
  );
};
