import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, Snackbar } from '@mui/material';
import { useTranslation } from '../LocalizationProvider';
import { prefixString } from '../../util/stringUtils';
import { formatAlarm } from '../../util/formatter';

const severityFor = (type) => {
  if (type === 'alarm' || type === 'deviceOverspeed') return 'error';
  if (type === 'ignitionOn') return 'success';
  if (type.startsWith('geofence')) return 'warning';
  return 'info';
};

// Shows live notifications as "Vehicle • Ignition on • 13:28". Tapping one opens the
// event on the map. When the page is in the background a system notification is shown.
const EventNotifier = () => {
  const navigate = useNavigate();
  const t = useTranslation();
  const events = useSelector((state) => state.events.items);
  const devices = useSelector((state) => state.devices.items);
  const [current, setCurrent] = useState(null);
  const seenRef = useRef(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(events.map((event) => event.id));
      return;
    }
    const fresh = events.filter(
      (event) => !seenRef.current.has(event.id) && event.attributes?.message,
    );
    events.forEach((event) => seenRef.current.add(event.id));
    if (!fresh.length) return;
    const event = fresh[0];
    const label =
      event.type === 'alarm'
        ? formatAlarm(event.attributes.alarm, t)
        : t(prefixString('event', event.type)) || event.type;
    const text = `${devices[event.deviceId]?.name || ''} • ${label} • ${dayjs(event.eventTime).format('HH:mm')}`;
    setCurrent({ id: event.id, text, severity: severityFor(event.type) });
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(label, {
        body: `${devices[event.deviceId]?.name || ''} • ${dayjs(event.eventTime).format('HH:mm')}`,
        tag: `event-${event.id}`,
      });
      notification.onclick = () => {
        window.focus();
        navigate(`/event/${event.id}`);
        notification.close();
      };
    }
  }, [events, devices, t, navigate]);

  return (
    <Snackbar
      key={current?.id}
      open={Boolean(current)}
      autoHideDuration={8000}
      onClose={(_, reason) => reason !== 'clickaway' && setCurrent(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        variant="filled"
        severity={current?.severity || 'info'}
        onClose={() => setCurrent(null)}
        onClick={() => {
          navigate(`/event/${current.id}`);
          setCurrent(null);
        }}
        sx={{ cursor: 'pointer', fontWeight: 600 }}
      >
        {current?.text}
      </Alert>
    </Snackbar>
  );
};

export default EventNotifier;
