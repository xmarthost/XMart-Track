import { useState } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ButtonBase, IconButton, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EditIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlaceIcon from '@mui/icons-material/Place';
import HistoryIcon from '@mui/icons-material/History';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CodeIcon from '@mui/icons-material/Code';
import SettingsIcon from '@mui/icons-material/Settings';
import NavigationIcon from '@mui/icons-material/Navigation';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import KeyIcon from '@mui/icons-material/VpnKey';
import BoltIcon from '@mui/icons-material/Bolt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BatteryStdIcon from '@mui/icons-material/BatteryStd';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import useDeviceExtras from '../common/util/useDeviceExtras';
import AddressValue from '../common/components/AddressValue';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance, formatTime, formatVoltage } from '../common/util/formatter';
import { speedFromKnots, speedUnitString } from '../common/util/converter';
import { getDeviceState, sinceNow, stateColors } from '../common/util/xmartStatus';
import { brand } from '../common/theme/palette';

const actionColors = {
  tracking: brand.blue,
  playback: '#10B981',
  alarm: brand.amber,
  command: brand.teal,
  more: '#14B8A6',
};

const useStyles = makeStyles()((theme) => ({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    borderRadius: '16px 16px 0 0',
    overflowY: 'auto',
    transition: 'max-height 200ms ease',
  },
  handle: {
    display: 'flex',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
  },
  section: {
    padding: theme.spacing(0, 2, 1.5),
    borderBottom: `8px solid ${theme.palette.background.default}`,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  name: {
    fontWeight: 700,
    fontSize: '1.15rem',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chip: {
    display: 'inline-block',
    marginTop: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    borderRadius: 4,
    fontSize: '0.85rem',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    marginTop: theme.spacing(2),
  },
  action: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    borderRadius: 12,
    padding: theme.spacing(0.5, 0),
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1.25),
    color: theme.palette.text.secondary,
    '& svg': {
      fontSize: 18,
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: theme.spacing(2),
  },
  info: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    paddingTop: theme.spacing(1.5),
  },
  carBox: {
    width: 84,
    height: 84,
    borderRadius: 8,
    backgroundColor: theme.palette.action.hover,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  kv: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

const MobileDeviceSheet = ({ deviceId, onClose }) => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const device = useSelector((state) => state.devices.items[deviceId]);
  const position = useSelector((state) => state.session.positions[deviceId]);
  const extras = useDeviceExtras(deviceId, position?.attributes?.ignition);
  const speedUnit = useAttributePreference('speedUnit', 'kmh');
  const distanceUnit = useAttributePreference('distanceUnit', 'km');

  if (!device) {
    return null;
  }

  const attributes = position?.attributes || {};
  const state = getDeviceState(device, position);
  const stateText = {
    moving: `${t('xmMoving')} ${position ? Math.round(speedFromKnots(position.speed, speedUnit)) : 0} ${speedUnitString(speedUnit, t)}`,
    static: `${attributes.ignition ? t('xmIdle') : t('xmStatic')} ${!attributes.ignition && extras.accSince ? `${sinceNow(extras.accSince)} ` : ''}${position?.valid === false ? 'LBS' : 'GPS'}`,
    offline: `${t('xmOffline')} ${sinceNow(device.lastUpdate)}`,
    inactive: t('xmInactive'),
  }[state];

  const actions = [
    { key: 'tracking', label: t('xmTracking'), icon: <PlaceIcon />, path: `/tracking/${deviceId}` },
    {
      key: 'playback',
      label: t('xmPlayback'),
      icon: <HistoryIcon />,
      path: `/replay?deviceId=${deviceId}`,
    },
    {
      key: 'alarm',
      label: t('xmAlerts'),
      icon: <NotificationsActiveIcon />,
      path: `/events?deviceId=${deviceId}`,
    },
    {
      key: 'command',
      label: t('xmCommands'),
      icon: <CodeIcon />,
      path: `/device-commands/${deviceId}`,
    },
    { key: 'more', label: t('xmMore'), icon: <SettingsIcon />, path: `/device-more/${deviceId}` },
  ];

  return (
    <Paper elevation={12} className={classes.sheet} style={{ maxHeight: expanded ? '85%' : '52%' }}>
      <div className={classes.handle}>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </div>
      <div className={classes.section}>
        <div className={classes.title}>
          <Typography className={classes.name}>{device.name}</Typography>
          <IconButton
            size="small"
            color="primary"
            onClick={() => navigate(`/settings/device/${deviceId}`)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <span
          className={classes.chip}
          style={{ color: stateColors[state], backgroundColor: `${stateColors[state]}1A` }}
        >
          {stateText}
        </span>
        <div className={classes.actions}>
          {actions.map((action) => (
            <ButtonBase
              key={action.key}
              className={classes.action}
              onClick={() => navigate(action.path)}
            >
              <span
                className={classes.actionIcon}
                style={{ backgroundColor: actionColors[action.key] }}
              >
                {action.icon}
              </span>
              <Typography variant="body2">{action.label}</Typography>
            </ButtonBase>
          ))}
        </div>
      </div>
      {position && (
        <div className={classes.section}>
          <div className={classes.row} style={{ alignItems: 'flex-start' }}>
            <LocationOnOutlinedIcon color="primary" />
            <Typography variant="body2" color="textPrimary" sx={{ flex: 1 }}>
              <AddressValue
                latitude={position.latitude}
                longitude={position.longitude}
                originalAddress={position.address}
                auto
              />
            </Typography>
            <IconButton
              size="small"
              color="primary"
              component="a"
              target="_blank"
              href={`https://www.google.com/maps/dir/?api=1&destination=${position.latitude},${position.longitude}`}
            >
              <NavigationIcon />
            </IconButton>
          </div>
          <div className={classes.grid}>
            <div className={classes.row}>
              <ScheduleIcon />
              <Typography variant="body2" noWrap>
                {dayjs(device.lastUpdate).format('YYYY-MM-DD HH:mm:ss')}
              </Typography>
            </div>
            <div className={classes.row}>
              <LocationOnOutlinedIcon />
              <Typography variant="body2" noWrap>
                {dayjs(position.fixTime).format('YYYY-MM-DD HH:mm')}
              </Typography>
            </div>
            <div className={classes.row}>
              <MemoryIcon />
              <Typography variant="body2" noWrap>
                {device.model || '--'}
              </Typography>
            </div>
            <div className={classes.row}>
              <KeyIcon />
              <Typography
                variant="body2"
                style={
                  attributes.ignition ? { color: stateColors.moving, fontWeight: 600 } : undefined
                }
              >
                {attributes.hasOwnProperty('ignition')
                  ? `${t('xmAcc')} ${attributes.ignition ? t('xmAccOn') : t('xmAccOff')}${extras.accSince ? ` (${sinceNow(extras.accSince)})` : ''}`
                  : '--'}
              </Typography>
            </div>
            {(attributes.power != null || attributes.battery != null) && (
              <div className={classes.row}>
                <BoltIcon />
                <Typography variant="body2">
                  {attributes.power != null
                    ? `${Number(attributes.power).toFixed(1)} V`
                    : formatVoltage(attributes.battery, t)}
                </Typography>
              </div>
            )}
            {attributes.batteryLevel != null && (
              <div className={classes.row}>
                <BatteryStdIcon />
                <Typography variant="body2">{`${attributes.batteryLevel}%`}</Typography>
              </div>
            )}
            {attributes.sat != null && (
              <div className={classes.row}>
                <SatelliteAltIcon />
                <Typography variant="body2">{attributes.sat}</Typography>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={classes.section}>
        <div className={classes.info}>
          <div className={classes.carBox}>
            <DirectionsCarIcon sx={{ fontSize: 40 }} />
          </div>
          <div>
            <Typography variant="body2" color="textSecondary">
              {`IMEI: ${device.uniqueId}`}
              <IconButton
                size="small"
                color="primary"
                onClick={() => navigator.clipboard?.writeText(device.uniqueId)}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {`${t('deviceModel')}: ${device.model || '--'}`}
            </Typography>
            {device.expirationTime && (
              <Typography variant="body2" color="textSecondary">
                {`${t('xmExpiry')}: ${formatTime(device.expirationTime, 'date')}`}
              </Typography>
            )}
          </div>
        </div>
      </div>
      <div className={classes.kv}>
        <Typography variant="body2">{t('xmMileage')}</Typography>
        <Typography variant="body2" color="textSecondary">
          {attributes.totalDistance != null
            ? formatDistance(attributes.totalDistance, distanceUnit, t)
            : '--'}
          <IconButton
            size="small"
            color="primary"
            sx={{ p: 0.25, ml: 0.5 }}
            onClick={() => navigate(`/settings/accumulators/${deviceId}`)}
          >
            <EditIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Typography>
      </div>
      <div className={classes.kv}>
        <Typography variant="body2">{t('xmTodayMileage')}</Typography>
        <Typography variant="body2" color="textSecondary">
          {extras.todayDistance != null
            ? formatDistance(extras.todayDistance, distanceUnit, t)
            : '--'}
        </Typography>
      </div>
    </Paper>
  );
};

export default MobileDeviceSheet;
