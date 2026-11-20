import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ButtonBase,
  Card,
  CardContent,
  CardHeader,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RouteIcon from '@mui/icons-material/Route';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import EventIcon from '@mui/icons-material/Event';
import TimelineIcon from '@mui/icons-material/Timeline';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HistoryIcon from '@mui/icons-material/History';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance, formatNumericHours } from '../common/util/formatter';
import { speedFromKnots, speedUnitString } from '../common/util/converter';
import { getDeviceState, stateColors } from '../common/util/xmartStatus';
import TableShimmer from '../common/components/TableShimmer';

const useStyles = makeStyles()((theme) => ({
  container: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: theme.spacing(2),
  },
  tile: {
    padding: theme.spacing(2),
    borderRadius: 10,
    borderLeft: '4px solid',
  },
  tileValue: {
    fontSize: '1.9rem',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  links: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: theme.spacing(1.5),
  },
  link: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 1),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  header: {
    '& .MuiCardHeader-title': {
      fontWeight: 700,
      fontSize: '1rem',
    },
  },
}));

const DashboardPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const speedUnit = useAttributePreference('speedUnit', 'kmh');
  const distanceUnit = useAttributePreference('distanceUnit', 'km');

  const [summary, setSummary] = useState(null);
  const [alertsToday, setAlertsToday] = useState(null);

  const deviceKey = Object.keys(devices).join();

  const counts = useMemo(() => {
    const result = { total: 0, moving: 0, static: 0, offline: 0, inactive: 0 };
    Object.values(devices).forEach((device) => {
      result.total += 1;
      result[getDeviceState(device, positions[device.id])] += 1;
    });
    return result;
  }, [devices, positions]);

  useAsyncTask(
    async ({ signal }) => {
      const deviceIds = deviceKey.split(',').filter(Boolean);
      if (!deviceIds.length) {
        setSummary([]);
        setAlertsToday(0);
        return;
      }
      const query = new URLSearchParams({
        from: dayjs().startOf('day').toISOString(),
        to: dayjs().endOf('day').toISOString(),
      });
      deviceIds.forEach((id) => query.append('deviceId', id));
      const headers = { Accept: 'application/json' };
      const [summaryResponse, eventsResponse] = await Promise.all([
        fetchOrThrow(`api/reports/summary?${query.toString()}`, { headers, signal }),
        fetchOrThrow(`api/reports/events?${query.toString()}`, { headers, signal }),
      ]);
      setSummary(await summaryResponse.json());
      setAlertsToday((await eventsResponse.json()).length);
    },
    [deviceKey],
  );

  const tiles = [
    { key: 'total', label: t('xmTotal'), value: counts.total, color: '#0F172A' },
    { key: 'moving', label: t('xmMoving'), value: counts.moving, color: stateColors.moving },
    { key: 'static', label: t('xmStatic'), value: counts.static, color: stateColors.static },
    { key: 'offline', label: t('xmOffline'), value: counts.offline, color: stateColors.offline },
    {
      key: 'inactive',
      label: t('xmInactive'),
      value: counts.inactive,
      color: stateColors.inactive,
    },
    {
      key: 'alerts',
      label: t('xmTodayAlerts'),
      value: alertsToday ?? '…',
      color: '#F59E0B',
      onClick: () => navigate('/events'),
    },
  ];

  const links = [
    { label: t('reportCombined'), icon: <AssessmentIcon />, path: '/reports/combined' },
    { label: t('reportTrips'), icon: <RouteIcon />, path: '/reports/trips' },
    { label: t('reportStops'), icon: <LocalParkingIcon />, path: '/reports/stops' },
    { label: t('reportSummary'), icon: <TimelineIcon />, path: '/reports/summary' },
    { label: t('reportEvents'), icon: <EventIcon />, path: '/events' },
    { label: t('reportChart'), icon: <ShowChartIcon />, path: '/reports/chart' },
    { label: t('xmPlayback'), icon: <HistoryIcon />, path: '/replay' },
    { label: t('reportPositions'), icon: <DirectionsCarIcon />, path: '/reports/route' },
  ];

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'xmFleetOverview']}>
      <Container maxWidth="lg" className={classes.container}>
        <div className={classes.tiles}>
          {tiles.map((tile) => (
            <Paper
              key={tile.key}
              variant="outlined"
              className={classes.tile}
              style={{ borderLeftColor: tile.color, cursor: tile.onClick ? 'pointer' : 'default' }}
              onClick={tile.onClick}
            >
              <Typography variant="body2" color="textSecondary">
                {tile.label}
              </Typography>
              <Typography className={classes.tileValue} style={{ color: tile.color }}>
                {tile.value}
              </Typography>
            </Paper>
          ))}
        </div>

        <Card variant="outlined">
          <CardHeader className={classes.header} title={t('xmTodaySummary')} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('sharedDevice')}</TableCell>
                <TableCell align="right">{t('sharedDistance')}</TableCell>
                <TableCell align="right">{t('reportMaximumSpeed')}</TableCell>
                <TableCell align="right">{t('reportEngineHours')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary === null ? (
                <TableShimmer columns={4} />
              ) : (
                summary.map((item) => (
                  <TableRow
                    key={item.deviceId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/reports/combined?deviceId=${item.deviceId}`)}
                  >
                    <TableCell>{item.deviceName}</TableCell>
                    <TableCell align="right">
                      {formatDistance(item.distance, distanceUnit, t)}
                    </TableCell>
                    <TableCell align="right">
                      {`${Math.round(speedFromKnots(item.maxSpeed, speedUnit))} ${speedUnitString(speedUnit, t)}`}
                    </TableCell>
                    <TableCell align="right">{formatNumericHours(item.engineHours, t)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Card variant="outlined">
          <CardHeader className={classes.header} title={t('xmReports')} />
          <CardContent className={classes.links}>
            {links.map((link) => (
              <ButtonBase
                key={link.path}
                className={classes.link}
                onClick={() => navigate(link.path)}
              >
                {link.icon}
                <Typography variant="body2" color="textPrimary" align="center">
                  {link.label}
                </Typography>
              </ButtonBase>
            ))}
          </CardContent>
        </Card>
      </Container>
    </PageLayout>
  );
};

export default DashboardPage;
