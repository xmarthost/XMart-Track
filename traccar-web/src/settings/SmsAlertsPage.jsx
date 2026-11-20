import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  FormControlLabel,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SmsIcon from '@mui/icons-material/Sms';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import dayjs from 'dayjs';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { sessionActions } from '../store';
import { useAdministrator } from '../common/util/permissions';

const alertTypes = [
  { key: 'accOn', types: ['ignitionOn'], label: 'xmAlertAccOn' },
  { key: 'accOff', types: ['ignitionOff'], label: 'xmAlertAccOff' },
  { key: 'overspeed', types: ['deviceOverspeed'], label: 'xmAlertOverspeed' },
  { key: 'geofence', types: ['geofenceEnter', 'geofenceExit'], label: 'xmAlertGeofence' },
  { key: 'alarm', types: ['alarm'], label: 'xmAlertAlarm' },
  { key: 'offline', types: ['deviceOffline'], label: 'xmAlertOffline' },
];

const hasSms = (notification) => (notification.notificators || '').split(',').includes('sms');

const useStyles = makeStyles()((theme) => ({
  container: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  header: {
    '& .MuiCardHeader-avatar': {
      color: theme.palette.primary.main,
    },
    '& .MuiCardHeader-title': {
      fontWeight: 700,
      fontSize: '1rem',
    },
  },
  toggles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing(0.5, 2),
  },
  preview: {
    maxWidth: 360,
    padding: theme.spacing(1.5, 2),
    borderRadius: 16,
    backgroundColor: theme.palette.action.hover,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
}));

const SmsAlertsPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();
  const admin = useAdministrator();

  const user = useSelector((state) => state.session.user);
  const serverAttributes = useSelector((state) => state.session.server.attributes);
  const firstDevice = useSelector((state) => Object.values(state.devices.items)[0]);

  const [numbers, setNumbers] = useState(() => (user.phone || '').split(/[,;\s]+/).filter(Boolean));
  const [notifications, setNotifications] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [smsAvailable, setSmsAvailable] = useState(true);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useAsyncTask(async ({ signal }) => {
    const [notificationsResponse, notificatorsResponse] = await Promise.all([
      fetchOrThrow('api/notifications', { signal }),
      fetchOrThrow('api/notifications/notificators', { signal }),
    ]);
    const items = await notificationsResponse.json();
    const notificators = await notificatorsResponse.json();
    setNotifications(items);
    setSmsAvailable(notificators.some((it) => it.type === 'sms'));
    const state = {};
    alertTypes.forEach((alert) => {
      state[alert.key] = alert.types.every((type) =>
        items.some((n) => n.type === type && hasSms(n)),
      );
    });
    setEnabled(state);
  }, []);

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const phone = numbers.join(',');
      if (phone !== (user.phone || '')) {
        const response = await fetchOrThrow(`api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...user, phone: phone || null }),
        });
        dispatch(sessionActions.updateUser(await response.json()));
      }
      const updated = [...notifications];
      for (const alert of alertTypes) {
        for (const type of alert.types) {
          const existing = updated.find((n) => n.type === type && hasSms(n));
          if (enabled[alert.key] && !existing) {
            const response = await fetchOrThrow('api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type,
                always: true,
                notificators: 'sms,web',
                attributes: { xmSms: true },
              }),
            });
            updated.push(await response.json());
          } else if (!enabled[alert.key] && existing) {
            if (existing.attributes?.xmSms) {
              await fetchOrThrow(`api/notifications/${existing.id}`, { method: 'DELETE' });
              updated.splice(updated.indexOf(existing), 1);
            } else {
              const notificators = existing.notificators
                .split(',')
                .filter((it) => it !== 'sms')
                .join(',');
              const response = await fetchOrThrow(`api/notifications/${existing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...existing, notificators }),
              });
              updated[updated.indexOf(existing)] = await response.json();
            }
          }
        }
      }
      setNotifications(updated);
      setMessage(t('xmSaved'));
    } finally {
      setSaving(false);
    }
  });

  const sendTest = useCatch(async () => {
    await fetchOrThrow('api/notifications/test/sms', { method: 'POST' });
    setMessage(t('xmTestSent'));
  });

  const sampleName = firstDevice?.name || 'LEA-19-961';
  const preview = `${sampleName}: Acc On Alarm :DateTime: ${dayjs().format('YYYY-MM-DD HH:mm:ss')} ,http://maps.google.com/maps?q=N31.396606,E74.176624`;
  const gatewayConfigured = Boolean(serverAttributes['xm.sms.url']);

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'xmSmsAlerts']}>
      <Container maxWidth="md" className={classes.container}>
        {!smsAvailable && <Alert severity="warning">{t('xmSmsNotEnabled')}</Alert>}
        {smsAvailable && !gatewayConfigured && (
          <Alert severity={admin ? 'warning' : 'info'}>{t('xmSmsGatewayMissing')}</Alert>
        )}
        <Card variant="outlined">
          <CardHeader
            className={classes.header}
            avatar={<SmsIcon />}
            title={t('xmSmsAlerts')}
            subheader={t('xmSmsAlertsHelp')}
          />
          <CardContent>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={numbers}
              onChange={(_, value) =>
                setNumbers(
                  value
                    .flatMap((it) => it.split(/[,;\s]+/))
                    .map((it) => it.trim())
                    .filter(Boolean),
                )
              }
              renderValue={(value, getItemProps) =>
                value.map((option, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return <Chip key={key} label={option} color="primary" {...itemProps} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('xmSmsNumbers')}
                  placeholder="03001234567"
                  helperText={t('xmSmsNumbersHelp')}
                />
              )}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader
            className={classes.header}
            avatar={<NotificationsActiveIcon />}
            title={t('xmAlerts')}
          />
          <CardContent className={classes.toggles}>
            {alertTypes.map((alert) => (
              <FormControlLabel
                key={alert.key}
                control={
                  <Switch
                    checked={Boolean(enabled[alert.key])}
                    onChange={(e) => setEnabled({ ...enabled, [alert.key]: e.target.checked })}
                  />
                }
                label={t(alert.label)}
              />
            ))}
          </CardContent>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              {t('xmSmsPreview')}
            </Typography>
            <Box className={classes.preview}>
              <Typography variant="body2">{preview}</Typography>
            </Box>
          </CardContent>
        </Card>

        <div className={classes.footer}>
          <Button variant="outlined" onClick={sendTest} disabled={!smsAvailable || !numbers.length}>
            {t('xmSendTest')}
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {t('sharedSave')}
          </Button>
        </div>
      </Container>
      <Snackbar
        open={Boolean(message)}
        autoHideDuration={3000}
        onClose={() => setMessage(null)}
        message={message}
      />
    </PageLayout>
  );
};

export default SmsAlertsPage;
