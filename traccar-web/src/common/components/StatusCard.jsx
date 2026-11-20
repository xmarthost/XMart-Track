import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Card,
  CardContent,
  Typography,
  CardActions,
  IconButton,
  Menu,
  MenuItem,
  CardMedia,
  Link,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import NearMeIcon from '@mui/icons-material/NearMe';
import HistoryIcon from '@mui/icons-material/History';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import StreetviewIcon from '@mui/icons-material/Streetview';
import ShareIcon from '@mui/icons-material/Share';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import TodayIcon from '@mui/icons-material/Today';
import BatteryStdIcon from '@mui/icons-material/BatteryStd';
import useDeviceExtras from '../util/useDeviceExtras';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import KeyIcon from '@mui/icons-material/VpnKey';
import SensorsIcon from '@mui/icons-material/Sensors';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SpeedIcon from '@mui/icons-material/Speed';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import AddressValue from './AddressValue';
import DriverValue from './DriverValue';
import EngineControlDialog from './xmart/EngineControlDialog';
import { formatDistance, formatPercentage, formatTime, formatVoltage } from '../util/formatter';
import { speedFromKnots, speedUnitString } from '../util/converter';
import { daysUntil, getDeviceState, sinceNow, stateColors } from '../util/xmartStatus';

import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';
import mediaUrl from '../util/mediaUrl';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    pointerEvents: 'auto',
    width: 440,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: 10,
  },
  expiry: {
    backgroundColor: '#FEF2F2',
    color: theme.palette.error.main,
    fontSize: '0.8rem',
    padding: theme.spacing(0.5, 2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1, 1, 2),
    cursor: 'move',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontWeight: 700,
    fontSize: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  state: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  media: {
    height: theme.dimensions.popupImageHeight,
  },
  content: {
    padding: theme.spacing(1.5, 2),
    maxHeight: theme.dimensions.cardContentMaxHeight,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1),
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  infoIcon: {
    display: 'flex',
    color: theme.palette.text.secondary,
    '& svg': {
      fontSize: 18,
    },
  },
  address: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    width: '25px',
    height: '25px',
    filter: 'brightness(0) invert(1)',
  },
  actions: {
    justifyContent: 'space-around',
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.5, 1),
    '& .MuiIconButton-root:not(.MuiIconButton-colorError):not(.MuiIconButton-colorSuccess)': {
      color: theme.palette.primary.main,
    },
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 5,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down('md')]: {
      left: '50%',
      bottom: `calc(${theme.spacing(3)} + ${theme.dimensions.bottomBarHeight}px)`,
    },
    transform: 'translateX(-50%)',
  },
}));

const StatusCard = ({ deviceId, position, onClose, disableActions, desktopPadding = 0 }) => {
  const { classes, cx } = useStyles({ desktopPadding });
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const deviceReadonly = useDeviceReadonly();

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);

  const deviceImage = device?.attributes?.deviceImage;

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);

  const [removing, setRemoving] = useState(false);
  const [engine, setEngine] = useState(null);
  const limitCommands = useRestriction('limitCommands');

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetchOrThrow('api/devices');
      dispatch(devicesActions.refresh(await response.json()));
    }
    setRemoving(false);
  });

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow('api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow('api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position, t]);

  const speedUnit = useAttributePreference('speedUnit', 'kmh');
  const distanceUnit = useAttributePreference('distanceUnit', 'km');
  const attributes = position?.attributes || {};
  const state = getDeviceState(device, position);
  const extras = useDeviceExtras(deviceId, attributes.ignition);
  const expiryDays = daysUntil(device?.expirationTime);

  const stateLabel = {
    moving: t('xmMoving'),
    static: t('xmStatic'),
    offline: t('xmOffline'),
    inactive: t('xmInactive'),
  }[state];

  let powerText = '--';
  if (attributes.power != null) {
    powerText = `${Number(attributes.power).toFixed(1)} V`;
  } else if (attributes.battery != null) {
    powerText = formatVoltage(attributes.battery, t);
  }

  const infoItems = position
    ? [
        {
          icon: <PersonOutlineIcon />,
          title: t('sharedDriver'),
          value: attributes.driverUniqueId ? (
            <DriverValue driverUniqueId={attributes.driverUniqueId} />
          ) : (
            device?.contact || '--'
          ),
        },
        {
          icon: <KeyIcon />,
          title: t('xmAcc'),
          value: attributes.hasOwnProperty('ignition')
            ? `${attributes.ignition ? t('xmAccOn') : t('xmAccOff')}${extras.accSince ? ` (${sinceNow(extras.accSince)})` : ''}`
            : '--',
          color: attributes.ignition ? stateColors.moving : undefined,
        },
        {
          icon: <SensorsIcon />,
          title: t('xmLastUpdate'),
          value: formatTime(device?.lastUpdate),
        },
        {
          icon: <GpsFixedIcon />,
          title: t('xmPositioning'),
          value: position.valid ? 'GPS' : 'LBS',
        },
        {
          icon: <ScheduleIcon />,
          title: t('xmFixTime'),
          value: formatTime(position.fixTime),
        },
        {
          icon: <BatteryChargingFullIcon />,
          title: t('xmPower'),
          value: powerText,
        },
        {
          icon: <RouteOutlinedIcon />,
          title: t('xmMileage'),
          value: (
            <>
              {attributes.totalDistance != null
                ? formatDistance(attributes.totalDistance, distanceUnit, t)
                : '--'}
              {!deviceReadonly && (
                <IconButton
                  size="small"
                  sx={{ p: 0.25, ml: 0.5 }}
                  onClick={() => navigate(`/settings/accumulators/${deviceId}`)}
                >
                  <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </>
          ),
        },
        {
          icon: <TodayIcon />,
          title: t('xmTodayMileage'),
          value:
            extras.todayDistance != null
              ? formatDistance(extras.todayDistance, distanceUnit, t)
              : '--',
        },
        {
          icon: <SpeedIcon />,
          title: t('positionSpeed'),
          value: `${Math.round(speedFromKnots(position.speed, speedUnit))} ${speedUnitString(speedUnit, t)}`,
        },
        {
          icon: <SatelliteAltIcon />,
          title: t('xmSatellites'),
          value: attributes.sat ?? '--',
        },
        {
          icon: <BatteryStdIcon />,
          title: t('xmBackupBattery'),
          value: attributes.batteryLevel != null ? formatPercentage(attributes.batteryLevel) : '--',
        },
      ]
    : [];

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: 'relative' }}
          >
            <Card elevation={6} className={classes.card}>
              {deviceImage && (
                <CardMedia
                  className={cx('draggable-header', classes.media)}
                  image={mediaUrl(device?.uniqueId, deviceImage)}
                />
              )}
              {expiryDays !== null && expiryDays <= 30 && (
                <div className={classes.expiry}>
                  {expiryDays < 0
                    ? t('xmExpired')
                    : t('xmExpiresIn').replace('{days}', String(expiryDays))}
                </div>
              )}
              <div className={cx('draggable-header', classes.header)}>
                <div className={classes.titleBlock}>
                  <Typography className={classes.title} noWrap>
                    {device.name}
                    {!deviceReadonly && (
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/settings/device/${deviceId}`)}
                        disabled={disableActions}
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {device.uniqueId}
                    {device.phone ? ` • ${device.phone}` : ''}
                  </Typography>
                </div>
                <div className={classes.state} style={{ color: stateColors[state] }}>
                  <span
                    className={classes.stateDot}
                    style={{ backgroundColor: stateColors[state] }}
                  />
                  {state === 'offline'
                    ? `${stateLabel} (${sinceNow(device.lastUpdate)})`
                    : stateLabel}
                </div>
                <IconButton size="small" onClick={onClose} onTouchStart={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>
              {position && (
                <CardContent className={classes.content}>
                  <div className={classes.grid}>
                    {infoItems.map((item) => (
                      <Tooltip key={item.title} title={item.title} placement="top-start">
                        <div className={classes.info}>
                          <span className={classes.infoIcon}>{item.icon}</span>
                          <Typography
                            variant="body2"
                            noWrap
                            style={item.color ? { color: item.color, fontWeight: 600 } : undefined}
                          >
                            {item.value}
                          </Typography>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                  <div className={classes.info}>
                    <span className={classes.infoIcon}>
                      <PlaceOutlinedIcon />
                    </span>
                    <Typography variant="body2">
                      {`${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`}
                    </Typography>
                  </div>
                  <div className={classes.info} style={{ alignItems: 'flex-start' }}>
                    <span className={classes.infoIcon}>
                      <HomeOutlinedIcon />
                    </span>
                    <Typography variant="body2" className={classes.address}>
                      <AddressValue
                        latitude={position.latitude}
                        longitude={position.longitude}
                        originalAddress={position.address}
                        auto
                      />
                    </Typography>
                    <Link component={RouterLink} to={`/position/${position.id}`} variant="body2">
                      {t('sharedShowDetails')}
                    </Link>
                  </div>
                </CardContent>
              )}
              <CardActions className={classes.actions} disableSpacing>
                <Tooltip title={t('xmTracking')}>
                  <span>
                    <IconButton
                      onClick={() => navigate(`/tracking/${deviceId}`)}
                      disabled={disableActions || !position}
                    >
                      <NearMeIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('xmPlayback')}>
                  <span>
                    <IconButton
                      onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                      disabled={disableActions || !position}
                    >
                      <HistoryIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('xmCommands')}>
                  <span>
                    <IconButton
                      onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                      disabled={disableActions || limitCommands}
                    >
                      <SendIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={attributes.blocked ? t('xmEngineRestore') : t('xmEngineCut')}>
                  <span>
                    <IconButton
                      color={attributes.blocked ? 'success' : 'error'}
                      onClick={() => setEngine(attributes.blocked ? 'engineResume' : 'engineStop')}
                      disabled={disableActions || readonly || limitCommands}
                    >
                      <PowerSettingsNewIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('xmStreetView')}>
                  <span>
                    <IconButton
                      component="a"
                      target="_blank"
                      disabled={!position}
                      href={
                        position
                          ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`
                          : undefined
                      }
                    >
                      <StreetviewIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                {!shareDisabled && !user.temporary && (
                  <Tooltip title={t('sharedShare')}>
                    <span>
                      <IconButton
                        onClick={() => navigate(`/settings/device/${deviceId}/share`)}
                        disabled={disableActions}
                      >
                        <ShareIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                <Tooltip title={t('sharedExtra')}>
                  <span>
                    <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} disabled={!position}>
                      <MoreHorizIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </CardActions>
            </Card>
          </Rnd>
        )}
      </div>
      <EngineControlDialog deviceId={deviceId} action={engine} onClose={() => setEngine(null)} />
      {position && (
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem
            onClick={() => navigate(`/stream?deviceId=${deviceId}`)}
            disabled={position.protocol !== 'jt808'}
          >
            {t('linkLiveVideo')}
          </MenuItem>
          {!readonly && <MenuItem onClick={handleGeofence}>{t('sharedCreateGeofence')}</MenuItem>}
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t('linkGoogleMaps')}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`https://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t('linkAppleMaps')}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            {t('linkStreetView')}
          </MenuItem>
          {navigationAppTitle && navigationAppLink && (
            <MenuItem
              component="a"
              target="_blank"
              href={navigationAppLink
                .replace('{latitude}', position.latitude)
                .replace('{longitude}', position.longitude)}
            >
              {navigationAppTitle}
            </MenuItem>
          )}
          {!disableActions && !deviceReadonly && (
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                setRemoving(true);
              }}
            >
              <Typography color="error">{t('sharedRemove')}</Typography>
            </MenuItem>
          )}
        </Menu>
      )}
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;
