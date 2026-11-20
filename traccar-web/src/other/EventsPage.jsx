import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import KeyIcon from '@mui/icons-material/VpnKey';
import KeyOffIcon from '@mui/icons-material/KeyOff';
import WarningIcon from '@mui/icons-material/Warning';
import SpeedIcon from '@mui/icons-material/Speed';
import HexagonIcon from '@mui/icons-material/HexagonOutlined';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import dayjs from 'dayjs';
import {
  Box,
  Chip,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from '../reports/components/ReportsMenu';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatAlarm, formatTime } from '../common/util/formatter';
import { prefixString } from '../common/util/stringUtils';
import AddressValue from '../common/components/AddressValue';
import TableShimmer from '../common/components/TableShimmer';

const ranges = {
  today: () => [dayjs().startOf('day'), dayjs().endOf('day')],
  yesterday: () => [
    dayjs().subtract(1, 'day').startOf('day'),
    dayjs().subtract(1, 'day').endOf('day'),
  ],
  week: () => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')],
};

const eventColor = (type) => {
  if (type === 'alarm' || type === 'deviceOverspeed') return 'error';
  if (type === 'ignitionOn' || type === 'deviceOnline' || type === 'deviceMoving') return 'success';
  if (type === 'ignitionOff' || type === 'deviceStopped') return 'info';
  if (type.startsWith('geofence')) return 'warning';
  return 'default';
};

const useStyles = makeStyles()((theme) => ({
  container: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
}));

const EventsPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const devices = useSelector((state) => state.devices.items);

  const [range, setRange] = useState('today');
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [deviceId, setDeviceId] = useState(searchParams.get('deviceId') || '');
  const [type, setType] = useState('');
  const [items, setItems] = useState(null);
  const [positionsById, setPositionsById] = useState({});
  const [version, setVersion] = useState(0);

  const deviceKey = Object.keys(devices).join();

  useAsyncTask(
    async ({ signal }) => {
      setItems(null);
      const ids = deviceId ? [deviceId] : deviceKey.split(',').filter(Boolean);
      if (!ids.length) {
        setItems([]);
        return;
      }
      const [from, to] = ranges[range]();
      const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      ids.forEach((id) => query.append('deviceId', id));
      const response = await fetchOrThrow(`api/reports/events?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      const result = await response.json();
      result.sort((a, b) => dayjs(b.eventTime).valueOf() - dayjs(a.eventTime).valueOf());
      setItems(result);
      const positionIds = [
        ...new Set(
          result
            .slice(0, 40)
            .map((e) => e.positionId)
            .filter(Boolean),
        ),
      ];
      if (positionIds.length) {
        const positionsQuery = new URLSearchParams();
        positionIds.forEach((positionId) => positionsQuery.append('id', positionId));
        const positionsResponse = await fetchOrThrow(`api/positions?${positionsQuery.toString()}`, {
          signal,
        });
        const map = {};
        (await positionsResponse.json()).forEach((position) => {
          map[position.id] = position;
        });
        setPositionsById(map);
      }
    },
    // version is a manual refresh trigger
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [range, deviceId, deviceKey, version],
  );

  const counts = useMemo(() => {
    const result = {};
    (items || []).forEach((item) => {
      result[item.type] = (result[item.type] || 0) + 1;
    });
    return result;
  }, [items]);

  const visible = (items || []).filter((item) => !type || item.type === type);

  const typeLabel = (value) => t(prefixString('event', value)) || value;

  if (!desktop) {
    const iconFor = (value) => {
      if (value === 'ignitionOn') return [<KeyIcon key="i" />, '#16A34A'];
      if (value === 'ignitionOff') return [<KeyOffIcon key="i" />, '#94A3B8'];
      if (value === 'alarm') return [<WarningIcon key="i" />, '#DC2626'];
      if (value === 'deviceOverspeed') return [<SpeedIcon key="i" />, '#F59E0B'];
      if (value.startsWith('geofence')) return [<HexagonIcon key="i" />, '#2563EB'];
      return [<NotificationsIcon key="i" />, '#007080'];
    };
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        <Paper square elevation={1} sx={{ pt: 'env(safe-area-inset-top)' }}>
          <Typography variant="h6" align="center" sx={{ py: 1.25, fontWeight: 700 }}>
            {t('xmAlerts')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, px: 1.5, pb: 1, overflowX: 'auto' }}>
            {Object.keys(ranges).map((key) => (
              <Chip
                key={key}
                label={
                  {
                    today: t('reportToday'),
                    yesterday: t('reportYesterday'),
                    week: t('xmLast7Days'),
                  }[key]
                }
                color={range === key ? 'primary' : 'default'}
                onClick={() => setRange(key)}
              />
            ))}
            {deviceId && (
              <Chip
                label={devices[deviceId]?.name}
                onDelete={() => setDeviceId('')}
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>
        </Paper>
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {items === null && (
            <Typography align="center" color="textSecondary">
              …
            </Typography>
          )}
          {items !== null && !visible.length && (
            <Typography align="center" color="textSecondary" sx={{ mt: 4 }}>
              {t('sharedNoData') || '—'}
            </Typography>
          )}
          {visible.map((item) => {
            const [icon, color] = iconFor(item.type);
            return (
              <Paper
                key={item.id}
                elevation={0}
                sx={{ borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}
              >
                <Box sx={{ display: 'flex', gap: 2, p: 2, alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      bgcolor: color,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography fontWeight={600} noWrap>
                        {item.type === 'alarm'
                          ? formatAlarm(item.attributes?.alarm, t)
                          : typeLabel(item.type)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {dayjs(item.eventTime).format('YYYY-MM-DD HH:mm')}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" noWrap>
                      {`${t('sharedDevice')}: ${devices[item.deviceId]?.name || ''}`}
                    </Typography>
                    {positionsById[item.positionId] && (
                      <Typography variant="caption" color="textSecondary" component="div">
                        <AddressValue
                          latitude={positionsById[item.positionId].latitude}
                          longitude={positionsById[item.positionId].longitude}
                          originalAddress={positionsById[item.positionId].address}
                          auto
                        />
                      </Typography>
                    )}
                  </Box>
                </Box>
                {item.positionId ? (
                  <Box
                    onClick={() => navigate(`/event/${item.id}`)}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 2,
                      py: 1.25,
                      borderTop: 1,
                      borderColor: 'divider',
                      cursor: 'pointer',
                    }}
                  >
                    <Typography variant="body2">{t('xmViewDetails')}</Typography>
                    <ChevronRightIcon color="action" />
                  </Box>
                ) : null}
              </Paper>
            );
          })}
        </Box>
      </Box>
    );
  }

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'xmEvents']}>
      <Container maxWidth="lg" className={classes.container}>
        <div className={classes.filters}>
          <ToggleButtonGroup
            size="small"
            exclusive
            color="primary"
            value={range}
            onChange={(_, value) => value && setRange(value)}
          >
            <ToggleButton value="today">{t('reportToday')}</ToggleButton>
            <ToggleButton value="yesterday">{t('reportYesterday')}</ToggleButton>
            <ToggleButton value="week">{t('xmLast7Days')}</ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t('sharedDevice')}</InputLabel>
            <Select
              label={t('sharedDevice')}
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <MenuItem value="">{t('xmAll')}</MenuItem>
              {Object.values(devices)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={t('xmRefresh')}>
            <IconButton onClick={() => setVersion(version + 1)}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
        <div className={classes.summary}>
          <Chip
            label={`${t('xmAll')} (${items?.length || 0})`}
            color={type ? 'default' : 'primary'}
            onClick={() => setType('')}
          />
          {Object.entries(counts).map(([key, count]) => (
            <Chip
              key={key}
              label={`${typeLabel(key)} (${count})`}
              color={type === key ? 'primary' : eventColor(key)}
              variant={type === key ? 'filled' : 'outlined'}
              onClick={() => setType(type === key ? '' : key)}
            />
          ))}
        </div>
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('positionFixTime')}</TableCell>
                <TableCell>{t('sharedDevice')}</TableCell>
                <TableCell>{t('sharedType')}</TableCell>
                <TableCell>{t('sharedDescription') || ''}</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items === null ? (
                <TableShimmer columns={5} />
              ) : (
                visible.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatTime(item.eventTime)}
                    </TableCell>
                    <TableCell>{devices[item.deviceId]?.name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={typeLabel(item.type)}
                        color={eventColor(item.type)}
                      />
                    </TableCell>
                    <TableCell>
                      {item.type === 'alarm' ? formatAlarm(item.attributes?.alarm, t) : ''}
                    </TableCell>
                    <TableCell padding="checkbox">
                      {item.positionId ? (
                        <IconButton size="small" onClick={() => navigate(`/event/${item.id}`)}>
                          <MapIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {items !== null && !visible.length && (
            <Typography sx={{ p: 4 }} align="center" color="textSecondary">
              {t('sharedNoData') || '—'}
            </Typography>
          )}
        </Paper>
      </Container>
    </PageLayout>
  );
};

export default EventsPage;
