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
import { useCatch } from '../reactHelper';
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
    borderRadius: 12,
    overflow: 'hidden',
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
