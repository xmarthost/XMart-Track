import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import {
  Box,
  ButtonBase,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Slider,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import RouteIcon from '@mui/icons-material/Route';
import SpeedIcon from '@mui/icons-material/Speed';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BackIcon from '../common/components/BackIcon';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapMarkers from '../map/MapMarkers';
import MapCamera from '../map/MapCamera';
import MapScale from '../map/MapScale';
import AddressValue from '../common/components/AddressValue';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance, formatNumericHours } from '../common/util/formatter';
import { speedFromKnots, speedUnitString } from '../common/util/converter';
import { formatDurationShort } from '../common/util/xmartStatus';
import { brand } from '../common/theme/palette';

const speeds = { slow: 500, medium: 200, fast: 60 };

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
  },
  map: {
    position: 'relative',
    flex: '0 0 45%',
    minHeight: 220,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    borderRadius: '16px 16px 0 0',
    marginTop: -12,
    zIndex: 2,
    position: 'relative',
  },
  section: {
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  play: {
    width: 44,
    height: 44,
    backgroundColor: theme.palette.text.primary,
    color: theme.palette.background.paper,
    '&:hover': {
      backgroundColor: theme.palette.text.secondary,
    },
  },
  days: {
    display: 'flex',
    gap: theme.spacing(1),
    overflowX: 'auto',
    alignItems: 'center',
  },
  day: {
    flexShrink: 0,
    width: 56,
    padding: theme.spacing(0.5, 0),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  dayActive: {
    backgroundColor: theme.palette.primary.main,
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    textAlign: 'center',
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: 10,
    padding: theme.spacing(1, 0),
    margin: theme.spacing(1.5, 2),
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    '& svg': { fontSize: 20 },
  },
  segment: {
    display: 'flex',
    gap: theme.spacing(1.5),
    alignItems: 'center',
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(1.25, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  segmentIcon: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}));

const XmPlaybackPage = () => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const devices = useSelector((state) => state.devices.items);
  const selectedId = useSelector((state) => state.devices.selectedId);
  const speedUnit = useAttributePreference('speedUnit', 'kmh');
  const distanceUnit = useAttributePreference('distanceUnit', 'km');

  const deviceId =
    Number(searchParams.get('deviceId')) || selectedId || Number(Object.keys(devices)[0]);
  const date = searchParams.get('date') || dayjs().format('YYYY-MM-DD');

  const [positions, setPositions] = useState([]);
  const [trips, setTrips] = useState([]);
  const [stops, setStops] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('medium');
  const [loading, setLoading] = useState(false);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  useAsyncTask(
    async ({ signal }) => {
      if (!deviceId) return;
      setLoading(true);
      setPlaying(false);
      setIndex(0);
      const from = dayjs(date).startOf('day');
      const to = from.endOf('day');
      const query = new URLSearchParams({
        deviceId,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const headers = { Accept: 'application/json' };
      try {
        const [routeResponse, tripsResponse, stopsResponse] = await Promise.all([
          fetchOrThrow(`api/reports/route?${query.toString()}`, { headers, signal }),
          fetchOrThrow(`api/reports/trips?${query.toString()}`, { headers, signal }),
          fetchOrThrow(`api/reports/stops?${query.toString()}`, { headers, signal }),
        ]);
        setPositions(await routeResponse.json());
        setTrips(await tripsResponse.json());
        setStops(await stopsResponse.json());
      } finally {
        setLoading(false);
      }
    },
    [deviceId, date],
  );

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        if (current >= positions.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speeds[speed]);
    return () => clearInterval(timer);
  }, [playing, speed, positions.length]);

  const current = positions[index];

  const segments = useMemo(
    () =>
      [
        ...trips.map((trip) => ({ ...trip, kind: 'trip' })),
        ...stops.map((stop) => ({ ...stop, kind: 'stop' })),
      ].sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()),
    [trips, stops],
  );

  const totals = useMemo(
    () => ({
      driving: trips.reduce((sum, trip) => sum + (trip.duration || 0), 0),
      distance: trips.reduce((sum, trip) => sum + (trip.distance || 0), 0),
      maxSpeed: trips.reduce((max, trip) => Math.max(max, trip.maxSpeed || 0), 0),
      parking: stops.reduce((sum, stop) => sum + (stop.duration || 0), 0),
    }),
    [trips, stops],
  );

  const seekTo = (time) => {
    const target = dayjs(time).valueOf();
    const found = positions.findIndex((p) => dayjs(p.fixTime).valueOf() >= target);
    setIndex(found >= 0 ? found : 0);
  };

  const days = Array.from({ length: 7 }, (_, i) => dayjs().subtract(i, 'day'));
  const formatSpeedValue = (knots) =>
    `${Math.round(speedFromKnots(knots || 0, speedUnit))} ${speedUnitString(speedUnit, t)}`;

  const marker = current
    ? [
        {
          id: current.id,
          deviceId,
          latitude: current.latitude,
          longitude: current.longitude,
          image: 'xmcar-moving',
          rotation: current.course,
          rotate: true,
        },
      ]
    : [];

  return (
    <div className={classes.root}>
      <Paper square elevation={1}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Select
            size="small"
            variant="standard"
            value={deviceId || ''}
            onChange={(e) => setParam('deviceId', e.target.value)}
            sx={{ flex: 1, fontWeight: 700 }}
          >
            {Object.values(devices).map((device) => (
              <MenuItem key={device.id} value={device.id}>
                {device.name}
              </MenuItem>
            ))}
          </Select>
        </Toolbar>
      </Paper>
      <div className={classes.map}>
        <MapView>
          <MapRoutePath positions={positions} color={brand.green} />
          <MapMarkers markers={marker} />
          {positions.length > 0 && <MapCamera positions={positions} />}
        </MapView>
        <MapScale />
      </div>
      <Paper elevation={6} className={classes.panel}>
        <div className={classes.section}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="textSecondary">
              {current ? dayjs(current.fixTime).format('YYYY-MM-DD HH:mm:ss') : '--'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {current ? formatSpeedValue(current.speed) : ''}
            </Typography>
          </Box>
          <div className={classes.controls}>
            <IconButton
              className={classes.play}
              disabled={positions.length < 2}
              onClick={() => {
                if (index >= positions.length - 1) setIndex(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Slider
              size="small"
              min={0}
              max={Math.max(positions.length - 1, 0)}
              value={index}
              onChange={(_, value) => setIndex(value)}
              sx={{ flex: 1 }}
            />
            <Select size="small" value={speed} onChange={(e) => setSpeed(e.target.value)}>
              <MenuItem value="slow">{t('xmSlow')}</MenuItem>
              <MenuItem value="medium">{t('xmMedium')}</MenuItem>
              <MenuItem value="fast">{t('xmFast')}</MenuItem>
            </Select>
          </div>
        </div>
        <div className={classes.section}>
          <div className={classes.days}>
            {days.map((day) => {
              const value = day.format('YYYY-MM-DD');
              return (
                <ButtonBase
                  key={value}
                  className={cx(classes.day, value === date && classes.dayActive)}
                  onClick={() => setParam('date', value)}
                >
                  <Typography variant="caption">{day.format('ddd')}</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {day.format('MM-DD')}
                  </Typography>
                </ButtonBase>
              );
            })}
            <TextField
              type="date"
              size="small"
              value={date}
              onChange={(e) => e.target.value && setParam('date', e.target.value)}
              sx={{ minWidth: 150 }}
            />
          </div>
        </div>
        <div className={classes.summary}>
          <div className={classes.summaryItem}>
            <DirectionsCarIcon sx={{ color: brand.green }} />
            <Typography variant="body2" fontWeight={700}>
              {formatDurationShort(totals.driving)}
            </Typography>
          </div>
          <div className={classes.summaryItem}>
            <RouteIcon sx={{ color: brand.blue }} />
            <Typography variant="body2" fontWeight={700}>
              {formatDistance(totals.distance, distanceUnit, t)}
            </Typography>
          </div>
          <div className={classes.summaryItem}>
            <SpeedIcon sx={{ color: brand.amber }} />
            <Typography variant="body2" fontWeight={700}>
              {formatSpeedValue(totals.maxSpeed)}
            </Typography>
          </div>
          <div className={classes.summaryItem}>
            <LocalParkingIcon sx={{ color: brand.blue }} />
            <Typography variant="body2" fontWeight={700}>
              {formatDurationShort(totals.parking)}
            </Typography>
          </div>
        </div>
        {loading && (
          <Typography align="center" color="textSecondary" sx={{ p: 2 }}>
            …
          </Typography>
        )}
        {!loading && !segments.length && (
          <Typography align="center" color="textSecondary" sx={{ p: 3 }}>
            {t('sharedNoData') || '—'}
          </Typography>
        )}
        {segments.map((segment) => (
          <ButtonBase
            key={`${segment.kind}-${segment.startTime}`}
            className={classes.segment}
            onClick={() => seekTo(segment.startTime)}
          >
            <span
              className={classes.segmentIcon}
              style={{ backgroundColor: segment.kind === 'trip' ? brand.green : brand.blue }}
            >
              {segment.kind === 'trip' ? <DirectionsCarIcon /> : <LocalParkingIcon />}
            </span>
            <Box sx={{ minWidth: 52 }}>
              <Typography variant="caption" color="textSecondary">
                {dayjs(segment.startTime).format('MM/DD')}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {dayjs(segment.startTime).format('HH:mm')}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2">
                <ScheduleIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                {formatNumericHours(segment.duration, t)}
                {segment.kind === 'trip' &&
                  ` • ${formatDistance(segment.distance, distanceUnit, t)} • ${formatSpeedValue(segment.maxSpeed)}`}
              </Typography>
              {segment.kind === 'stop' && (
                <Typography variant="caption" color="textSecondary" component="div" noWrap>
                  <AddressValue
                    latitude={segment.latitude}
                    longitude={segment.longitude}
                    originalAddress={segment.address}
                    auto
                  />
                </Typography>
              )}
            </Box>
          </ButtonBase>
        ))}
      </Paper>
    </div>
  );
};

export default XmPlaybackPage;
