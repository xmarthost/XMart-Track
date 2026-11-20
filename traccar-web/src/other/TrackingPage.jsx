import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { Chip, Fab, IconButton, Paper, Switch, Toolbar, Tooltip, Typography } from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import AddressValue from '../common/components/AddressValue';
import { makeStyles } from 'tss-react/mui';
import HistoryIcon from '@mui/icons-material/History';
import MapView, { map } from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapPositionMarkers from '../map/MapPositionMarkers';
import MapGeofence from '../map/MapGeofence';
import MapScale from '../map/MapScale';
import MapOverlay from '../map/overlay/MapOverlay';
import BackIcon from '../common/components/BackIcon';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { toMapCoordinates } from '../map/core/mapUtil';
import { formatTime } from '../common/util/formatter';
import { useAttributePreference } from '../common/util/preferences';
import { speedFromKnots, speedUnitString } from '../common/util/converter';
import { getDeviceState, sinceNow, stateColors } from '../common/util/xmartStatus';

const TRAIL_HOURS = 1;
const TRAIL_LIMIT = 2000;

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    position: 'relative',
  },
  panel: {
    position: 'absolute',
    top: theme.spacing(1.5),
    left: theme.spacing(1.5),
    zIndex: 3,
    minWidth: 320,
    borderRadius: 10,
  },
  toolbar: {
    gap: theme.spacing(1),
  },
  title: {
    flex: 1,
    fontWeight: 700,
  },
  bottom: {
    position: 'absolute',
    left: theme.spacing(1.5),
    right: theme.spacing(1.5),
    bottom: theme.spacing(1.5),
    zIndex: 3,
    borderRadius: 14,
    padding: theme.spacing(2),
    maxWidth: 520,
    margin: '0 auto',
  },
  navigate: {
    position: 'absolute',
    right: theme.spacing(2),
    top: theme.spacing(-3.5),
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(0.5, 2),
    padding: theme.spacing(0, 2, 1.5),
  },
}));

const TrackingPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const { id } = useParams();
  const deviceId = Number(id);

  const device = useSelector((state) => state.devices.items[deviceId]);
  const position = useSelector((state) => state.session.positions[deviceId]);
  const speedUnit = useAttributePreference('speedUnit', 'kmh');

  const [trail, setTrail] = useState([]);
  const [follow, setFollow] = useState(true);

  useAsyncTask(
    async ({ signal }) => {
      const query = new URLSearchParams({
        deviceId,
        from: dayjs().subtract(TRAIL_HOURS, 'hour').toISOString(),
        to: dayjs().toISOString(),
      });
      const response = await fetchOrThrow(`api/positions?${query.toString()}`, { signal });
      setTrail((await response.json()).slice(-TRAIL_LIMIT));
    },
    [deviceId],
  );

  useEffect(() => {
    if (position) {
      setTrail((previous) => {
        const last = previous.at(-1);
        if (last && last.id === position.id) {
          return previous;
        }
        return [...previous, position].slice(-TRAIL_LIMIT);
      });
    }
  }, [position]);

  useEffect(() => {
    if (follow && position) {
      map.easeTo({
        center: toMapCoordinates(position.longitude, position.latitude),
        zoom: Math.max(map.getZoom(), 15),
      });
    }
  }, [follow, position]);

  const state = getDeviceState(device, position);

  return (
    <div className={classes.root}>
      <MapView>
        <MapOverlay />
        <MapGeofence />
        <MapRoutePath positions={trail} />
        {position && <MapPositionMarkers positions={[position]} showStatus />}
      </MapView>
      <MapScale />
      <Paper elevation={4} className={classes.panel}>
        <Toolbar className={classes.toolbar} disableGutters sx={{ px: 1 }}>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography className={classes.title} noWrap>
            {`${t('xmTrackingMode')}: ${device?.name || ''}`}
          </Typography>
          <Tooltip title={t('xmPlayback')}>
            <IconButton onClick={() => navigate(`/replay?deviceId=${deviceId}`)}>
              <HistoryIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        <div className={classes.stats}>
          <Chip
            size="small"
            label={t(`xm${state.charAt(0).toUpperCase()}${state.slice(1)}`)}
            sx={{ backgroundColor: stateColors[state], color: '#fff', justifySelf: 'start' }}
          />
          <Typography variant="body2" align="right">
            {position
              ? `${Math.round(speedFromKnots(position.speed, speedUnit))} ${speedUnitString(speedUnit, t)}`
              : '--'}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {position ? formatTime(position.fixTime) : ''}
          </Typography>
          <Typography variant="caption" align="right">
            {t('deviceFollow')}
            <Switch size="small" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          </Typography>
        </div>
      </Paper>
      {position && (
        <Paper elevation={6} className={classes.bottom}>
          <Fab
            color="primary"
            className={classes.navigate}
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/dir/?api=1&destination=${position.latitude},${position.longitude}`}
          >
            <NavigationIcon />
          </Fab>
          <Typography variant="h6" fontWeight={700} sx={{ color: stateColors[state] }}>
            {state === 'moving'
              ? `${t('xmMoving')} ${Math.round(speedFromKnots(position.speed, speedUnit))} ${speedUnitString(speedUnit, t)}`
              : `${t(`xm${state.charAt(0).toUpperCase()}${state.slice(1)}`)} ${sinceNow(position.fixTime)}`}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, pr: 7 }}>
            <AddressValue
              latitude={position.latitude}
              longitude={position.longitude}
              originalAddress={position.address}
              auto
            />
          </Typography>
          <Typography variant="caption" color="textSecondary" component="div" sx={{ mt: 0.5 }}>
            {`${t('xmFixTime')}: ${formatTime(position.fixTime)}`}
          </Typography>
        </Paper>
      )}
    </div>
  );
};

export default TrackingPage;
