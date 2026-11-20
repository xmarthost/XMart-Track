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
  moving: '#16A34A',
  static: '#2563EB',
  offline: '#DC2626',
  inactive: '#94A3B8',
};

const xmCarSvg = (color) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
<ellipse cx='24' cy='43' rx='10' ry='3' fill='rgba(0,0,0,0.22)'/>
<rect x='13.5' y='4' width='21' height='39' rx='8.5' fill='${color}' stroke='#ffffff' stroke-width='2'/>
<path d='M16.5 14.5 Q24 10.5 31.5 14.5 L30 20.5 Q24 18.5 18 20.5 Z' fill='#0f172a' opacity='0.85'/>
<rect x='17.5' y='21.5' width='13' height='10' rx='2' fill='#ffffff' opacity='0.28'/>
<path d='M18 33 Q24 35 30 33 L31 38.5 Q24 40.5 17 38.5 Z' fill='#0f172a' opacity='0.7'/>
<rect x='15.5' y='5.5' width='4' height='2.2' rx='1' fill='#fde68a'/>
<rect x='28.5' y='5.5' width='4' height='2.2' rx='1' fill='#fde68a'/>
</svg>`)}`;

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
