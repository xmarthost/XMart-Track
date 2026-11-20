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
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
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

const WHATSAPP = 'xmwhatsapp';

const splitNumbers = (value) =>
  (value || '')
    .split(/[,;\s]+/)
    .map((it) => it.trim())
    .filter(Boolean);

const notificatorList = (notification) => (notification.notificators || '').split(',');

// notifications created by this page carry attributes.xmSms
const isManaged = (notification) => Boolean(notification.attributes?.xmSms);

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
  previews: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing(2),
  },
  bubble: {
    padding: theme.spacing(1.5, 2),
    borderRadius: 16,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
}));

const NumbersField = ({ label, helper, value, onChange, color }) => (
  <Autocomplete
    multiple
    freeSolo
    options={[]}
    value={value}
    onChange={(_, items) => onChange(items.flatMap(splitNumbers))}
    renderValue={(items, getItemProps) =>
      items.map((option, index) => {
        const { key, ...itemProps } = getItemProps({ index });
        return <Chip key={key} label={option} color={color} {...itemProps} />;
      })
    }
    renderInput={(params) => (
      <TextField {...params} label={label} placeholder="03001234567" helperText={helper} />
    )}
  />
);

const SmsAlertsPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();
  const admin = useAdministrator();

  const user = useSelector((state) => state.session.user);
  const serverAttributes = useSelector((state) => state.session.server.attributes);
  const firstDevice = useSelector((state) => Object.values(state.devices.items)[0]);

  const [smsNumbers, setSmsNumbers] = useState(() => splitNumbers(user.phone));
  const [waNumbers, setWaNumbers] = useState(() =>
    splitNumbers(user.attributes?.['xm.whatsappNumbers']),
  );
  const [notifications, setNotifications] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [channels, setChannels] = useState({ sms: true, whatsapp: true });
  const [available, setAvailable] = useState({ sms: true, whatsapp: true });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useAsyncTask(async ({ signal }) => {
    const [notificationsResponse, notificatorsResponse] = await Promise.all([
      fetchOrThrow('api/notifications', { signal }),
      fetchOrThrow('api/notifications/notificators', { signal }),
    ]);
    const items = await notificationsResponse.json();
    const notificators = (await notificatorsResponse.json()).map((it) => it.type);
    setNotifications(items);
    setAvailable({ sms: notificators.includes('sms'), whatsapp: notificators.includes(WHATSAPP) });
    const managed = items.filter(isManaged);
    const state = {};
    alertTypes.forEach((alert) => {
      state[alert.key] = alert.types.every((type) =>
        items.some(
          (n) =>
            n.type === type &&
            (notificatorList(n).includes('sms') || notificatorList(n).includes(WHATSAPP)),
        ),
      );
    });
    setEnabled(state);
    if (managed.length) {
      setChannels({
        sms: managed.some((n) => notificatorList(n).includes('sms')),
        whatsapp: managed.some((n) => notificatorList(n).includes(WHATSAPP)),
      });
    }
  }, []);

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const phone = smsNumbers.join(',');
      const whatsapp = waNumbers.join(',');
      if (
        phone !== (user.phone || '') ||
        whatsapp !== (user.attributes?.['xm.whatsappNumbers'] || '')
      ) {
        const attributes = { ...user.attributes };
        if (whatsapp) {
          attributes['xm.whatsappNumbers'] = whatsapp;
        } else {
          delete attributes['xm.whatsappNumbers'];
        }
        const response = await fetchOrThrow(`api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...user, phone: phone || null, attributes }),
        });
        dispatch(sessionActions.updateUser(await response.json()));
      }

      const wanted = ['web'];
      if (channels.sms && available.sms) wanted.push('sms');
      if (channels.whatsapp && available.whatsapp) wanted.push(WHATSAPP);
      const notificators = wanted.join(',');

      const updated = [...notifications];
      for (const alert of alertTypes) {
        for (const type of alert.types) {
          const existing = updated.find((n) => n.type === type && isManaged(n));
          const on = enabled[alert.key] && wanted.length > 1;
          if (on && !existing) {
            const response = await fetchOrThrow('api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type,
                always: true,
                notificators,
                attributes: { xmSms: true },
              }),
            });
            updated.push(await response.json());
          } else if (on && existing && existing.notificators !== notificators) {
            const response = await fetchOrThrow(`api/notifications/${existing.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...existing, notificators }),
            });
            updated[updated.indexOf(existing)] = await response.json();
          } else if (!on && existing) {
            await fetchOrThrow(`api/notifications/${existing.id}`, { method: 'DELETE' });
            updated.splice(updated.indexOf(existing), 1);
          }
        }
      }
      setNotifications(updated);
      setMessage(t('xmSaved'));
    } finally {
      setSaving(false);
    }
  });

  const sendTest = useCatch(async (notificator) => {
    await fetchOrThrow(`api/notifications/test/${notificator}`, { method: 'POST' });
    setMessage(t('xmTestSent'));
  });

  const sampleName = firstDevice?.name || 'LEA-19-961';
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const smsPreview = `${sampleName}: Acc On Alarm :DateTime: ${now} ,http://maps.google.com/maps?q=N31.396606,E74.176624`;
  const waPreview = `🚘 *${sampleName}*\n🟢 Vehicle started (ACC ON)\n🕒 ${now}\n📍 Bahria Town, Lahore, Punjab, Pakistan\n🗺️ https://maps.google.com/maps?q=31.396606,74.176624\n\n_XMart Track_`;
  const smsGateway = Boolean(serverAttributes['xm.sms.url']);
  const waGateway = Boolean(serverAttributes['xm.wa.secret'] && serverAttributes['xm.wa.account']);

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'xmSmsAlerts']}>
      <Container maxWidth="md" className={classes.container}>
        <Card variant="outlined">
          <CardHeader
            className={classes.header}
            avatar={<WhatsAppIcon sx={{ color: '#25D366' }} />}
            title={t('xmWhatsappAlerts')}
            subheader={t('xmWhatsappAlertsHelp')}
            action={
              <Switch
                checked={channels.whatsapp}
                onChange={(e) => setChannels({ ...channels, whatsapp: e.target.checked })}
              />
            }
          />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {!available.whatsapp && <Alert severity="warning">{t('xmWhatsappNotEnabled')}</Alert>}
            {available.whatsapp && !waGateway && (
              <Alert severity={admin ? 'warning' : 'info'}>{t('xmWhatsappGatewayMissing')}</Alert>
            )}
            <NumbersField
              label={t('xmWhatsappNumbers')}
              helper={t('xmSmsNumbersHelp')}
              value={waNumbers}
              onChange={setWaNumbers}
              color="success"
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader
            className={classes.header}
            avatar={<SmsIcon />}
            title={t('xmSmsCard')}
            subheader={t('xmSmsAlertsHelp')}
            action={
              <Switch
                checked={channels.sms}
                onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
              />
            }
          />
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {!available.sms && <Alert severity="warning">{t('xmSmsNotEnabled')}</Alert>}
            {available.sms && !smsGateway && (
              <Alert severity={admin ? 'warning' : 'info'}>{t('xmSmsGatewayMissing')}</Alert>
            )}
            <NumbersField
              label={t('xmSmsNumbers')}
              helper={t('xmSmsNumbersHelp')}
              value={smsNumbers}
              onChange={setSmsNumbers}
              color="primary"
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
          <CardContent className={classes.previews}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                WhatsApp
              </Typography>
              <Box className={classes.bubble} sx={{ backgroundColor: '#DCF8C6' }}>
                <Typography variant="body2">{waPreview}</Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                SMS
              </Typography>
              <Box className={classes.bubble} sx={{ backgroundColor: 'action.hover' }}>
                <Typography variant="body2">{smsPreview}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <div className={classes.footer}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<WhatsAppIcon />}
            onClick={() => sendTest(WHATSAPP)}
            disabled={!available.whatsapp || !waNumbers.length}
          >
            {t('xmSendTestWhatsapp')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => sendTest('sms')}
            disabled={!available.sms || !smsNumbers.length}
          >
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
