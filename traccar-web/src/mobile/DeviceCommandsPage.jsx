import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BackIcon from '../common/components/BackIcon';
import { useTranslation } from '../common/components/LocalizationProvider';
import dayjs from 'dayjs';
import { useAsyncTask, useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useRestriction } from '../common/util/permissions';

// type: Traccar command type; data: text for custom commands ({value} is replaced by the input)
const groups = [
  {
    key: 'control',
    title: 'xmGroupControl',
    items: [
      { key: 'engineStop', label: 'commandEngineStop', type: 'engineStop', danger: true },
      { key: 'engineResume', label: 'commandEngineResume', type: 'engineResume' },
    ],
  },
  {
    key: 'query',
    title: 'xmGroupQuery',
    items: [
      { key: 'status', label: 'xmQueryStatus', type: 'custom', data: 'status#' },
      { key: 'location', label: 'xmQueryLocation', type: 'custom', data: 'DW' },
      { key: 'param', label: 'xmQueryParams', type: 'custom', data: 'PARAM#' },
      { key: 'accQuery', label: 'xmQueryAccAlert', type: 'custom', data: 'ACCALM#' },
    ],
  },
  {
    key: 'setting',
    title: 'xmGroupSetting',
    items: [
      {
        key: 'sos',
        label: 'xmAddSos',
        type: 'custom',
        data: 'sos,a,{value}#',
        input: 'xmSosNumbers',
      },
      {
        key: 'accOn',
        label: 'xmAccSmsOn',
        type: 'custom',
        data: 'ACCALM,ON,1#',
        note: 'xmAccSmsNote',
      },
      { key: 'accOff', label: 'xmAccSmsOff', type: 'custom', data: 'ACCALM,OFF#' },
      {
        key: 'realtime',
        label: 'xmRealtimeMode',
        type: 'custom',
        data: 'TIMER,10,300#',
        note: 'xmRealtimeNote',
      },
      {
        key: 'timer',
        label: 'xmUploadInterval',
        type: 'custom',
        data: 'TIMER,{value}#',
        input: 'xmUploadIntervalInput',
      },
      {
        key: 'gmt',
        label: 'xmTimezoneCommand',
        type: 'custom',
        data: 'GMT,E,5,0#',
      },
      {
        key: 'center',
        label: 'xmSetCenter',
        type: 'custom',
        data: 'center,a,{value}#',
        input: 'xmCenterNumber',
      },
    ],
  },
  {
    key: 'custom',
    title: 'xmGroupCustom',
    items: [
      {
        key: 'custom',
        label: 'xmCustomCommand',
        type: 'custom',
        data: '{value}',
        input: 'xmCommandText',
      },
    ],
  },
];

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  group: {
    borderRadius: 16,
    overflow: 'hidden',
    flexShrink: 0,
    boxShadow: '0 3px 14px rgba(15, 23, 42, 0.06)',
    '& .MuiListItemButton-root': {
      minHeight: 52,
    },
    '& .MuiListItemButton-root:last-of-type': {
      borderBottom: 'none',
    },
  },
  groupTitle: {
    fontWeight: 700,
    padding: theme.spacing(1.5, 2, 0.5),
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    margin: theme.spacing(1.5, 0, 0.5, 2),
    paddingLeft: theme.spacing(1),
    paddingTop: 0,
  },
  code: {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    fontWeight: 700,
    padding: theme.spacing(1, 1.5),
    borderRadius: 8,
    backgroundColor: theme.palette.action.hover,
    wordBreak: 'break-all',
  },
}));

const DeviceCommandsPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const { id } = useParams();
  const deviceId = Number(id);
  const device = useSelector((state) => state.devices.items[deviceId]);
  const readonly = useRestriction('readonly');
  const limitCommands = useRestriction('limitCommands');

  const [selected, setSelected] = useState(null);
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const liveReplies = useSelector((state) =>
    state.events.items.filter((e) => e.deviceId === deviceId && e.type === 'commandResult'),
  );

  useAsyncTask(
    async ({ signal }) => {
      const query = new URLSearchParams({
        deviceId,
        type: 'commandResult',
        from: dayjs().subtract(3, 'day').toISOString(),
        to: dayjs().add(1, 'minute').toISOString(),
      });
      const response = await fetch(`api/reports/events?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      if (response.ok) {
        setHistory(await response.json());
      }
    },
    // result changes after a command is sent: reload the reply list
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [deviceId, result],
  );

  const replies = [...liveReplies, ...history]
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
    .sort((a, b) => dayjs(b.eventTime).valueOf() - dayjs(a.eventTime).valueOf())
    .slice(0, 20);

  const text = selected?.data ? selected.data.replace('{value}', value.trim()) : null;

  const send = useCatch(async () => {
    const command =
      selected.type === 'custom'
        ? { deviceId, type: 'custom', attributes: { data: text } }
        : { deviceId, type: selected.type, attributes: {} };
    const response = await fetchOrThrow('api/commands/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    setResult(response.status === 202 ? t('xmCommandQueued') : t('xmCommandSent'));
    setSelected(null);
  });

  const disabled = readonly || limitCommands;

  return (
    <div className={classes.root}>
      <Paper square elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', mr: 5 }}>
            {t('xmCommands')}
          </Typography>
        </Toolbar>
      </Paper>
      <div className={classes.content}>
        {device && (
          <Typography variant="body2" color="textSecondary" align="center">
            {`${device.name} • ${device.status === 'online' ? t('xmOnline') : t('xmOffline')}`}
          </Typography>
        )}
        {disabled && <Alert severity="warning">{t('xmCommandsRestricted')}</Alert>}
        {groups.map((group) => (
          <Paper key={group.key} elevation={0} className={classes.group}>
            <Typography className={classes.groupTitle}>{t(group.title)}</Typography>
            <List disablePadding>
              {group.items.map((item) => (
                <ListItemButton
                  key={item.key}
                  divider
                  disabled={disabled}
                  onClick={() => {
                    setValue('');
                    setSelected(item);
                  }}
                >
                  <ListItemText
                    primary={t(item.label)}
                    slotProps={{ primary: { color: item.danger ? 'error' : 'textSecondary' } }}
                  />
                  <ChevronRightIcon color="action" />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        ))}
        <Paper elevation={0} className={classes.group}>
          <Typography className={classes.groupTitle}>{t('xmCommandReplies')}</Typography>
          {replies.length ? (
            <List disablePadding>
              {replies.map((reply) => (
                <Box
                  key={reply.id}
                  sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Typography variant="caption" color="textSecondary">
                    {dayjs(reply.eventTime).format('YYYY-MM-DD HH:mm:ss')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ wordBreak: 'break-word', fontFamily: 'monospace' }}
                  >
                    {reply.attributes?.result}
                  </Typography>
                </Box>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="textSecondary" sx={{ px: 2, pb: 2 }}>
              {t('xmNoReplies')}
            </Typography>
          )}
        </Paper>
      </div>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="xs">
        <DialogTitle>{selected && t(selected.label)}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {selected?.danger && <Alert severity="error">{t('xmEngineCutConfirm')}</Alert>}
          {selected?.input && (
            <TextField
              autoFocus
              label={t(selected.input)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
          {text && <Box className={classes.code}>{text}</Box>}
          {selected?.note && (
            <Typography variant="caption" color="textSecondary">
              {t(selected.note)}
            </Typography>
          )}
          {device?.status !== 'online' && <Alert severity="info">{t('xmCommandQueued')}</Alert>}
        </DialogContent>
        <DialogActions>
          {text && device?.phone && (
            <Button component="a" href={`sms:${device.phone}?body=${encodeURIComponent(text)}`}>
              {t('xmSendSms')}
            </Button>
          )}
          <Button onClick={() => setSelected(null)}>{t('sharedCancel')}</Button>
          <Button
            variant="contained"
            color={selected?.danger ? 'error' : 'primary'}
            disabled={Boolean(selected?.input) && !value.trim()}
            onClick={send}
          >
            {t('commandSend')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(result)}
        autoHideDuration={3500}
        onClose={() => setResult(null)}
        message={result}
      />
    </div>
  );
};

export default DeviceCommandsPage;
