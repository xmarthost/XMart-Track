import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SmsIcon from '@mui/icons-material/Sms';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from '../LocalizationProvider';
import { useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';
import { devicesActions } from '../../../store';
import { apnPresets, fillCommand, trackerModels } from './trackerModels';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  command: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1, 1, 1.5),
    borderRadius: 8,
    border: `1px dashed ${theme.palette.primary.main}`,
    backgroundColor: `${theme.palette.primary.main}0D`,
  },
  commandText: {
    flex: 1,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.95rem',
    fontWeight: 600,
    wordBreak: 'break-all',
  },
  serverInfo: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: theme.spacing(0.5, 2),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    backgroundColor: theme.palette.action.hover,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

const CommandBox = ({ label, command, phone }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!command) {
    return null;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const area = document.createElement('textarea');
      area.value = command;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <div className={classes.command}>
        <Typography className={classes.commandText}>{command}</Typography>
        <Tooltip title={copied ? t('xmCopied') : t('xmCopy')} open={copied || undefined}>
          <IconButton size="small" color="primary" onClick={copy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {phone && (
          <Tooltip title={t('xmSendSms')}>
            <IconButton
              size="small"
              color="primary"
              component="a"
              href={`sms:${phone}?body=${encodeURIComponent(command)}`}
            >
              <SmsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
    </Box>
  );
};

const QuickAddDeviceDialog = ({ open, onClose }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const serverAttributes = useSelector((state) => state.session.server.attributes);
  const host = serverAttributes['xm.deviceHost'] || window.location.hostname;

  const [step, setStep] = useState(0);
  const [imei, setImei] = useState('');
  const [name, setName] = useState('');
  const [simNumber, setSimNumber] = useState('');
  const [modelId, setModelId] = useState(trackerModels[0].id);
  const [apnId, setApnId] = useState(apnPresets[0].id);
  const [deviceId, setDeviceId] = useState(null);
  const [saving, setSaving] = useState(false);

  const device = useSelector((state) => (deviceId ? state.devices.items[deviceId] : null));
  const model = trackerModels.find((it) => it.id === modelId);
  const apn = apnPresets.find((it) => it.id === apnId)?.apn;
  const values = { host, port: model.port, apn };
  const serverCommand = fillCommand(
    serverAttributes['xm.serverCommand'] || model.serverCommand,
    values,
  );

  const imeiValid = /^\d{10,20}$/.test(imei.trim());

  const reset = () => {
    setStep(0);
    setImei('');
    setName('');
    setSimNumber('');
    setDeviceId(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = useCatch(async () => {
    setSaving(true);
    try {
      const uniqueId = imei.trim();
      const response = await fetchOrThrow('api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || `Car ${uniqueId.slice(-4)}`,
          uniqueId,
          phone: simNumber.trim() || null,
          model: model.name,
          category: 'car',
        }),
      });
      const created = await response.json();
      dispatch(devicesActions.update([created]));
      setDeviceId(created.id);
      setStep(1);
    } finally {
      setSaving(false);
    }
  });

  const hasPosition = useSelector((state) =>
    deviceId ? Boolean(state.session.positions[deviceId]) : false,
  );
  const connected = hasPosition || device?.status === 'online';

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{t('xmAddDevice')}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 2 }}>
          <Step>
            <StepLabel>{t('xmStepImei')}</StepLabel>
          </Step>
          <Step>
            <StepLabel>{t('xmStepConfigure')}</StepLabel>
          </Step>
        </Stepper>

        {step === 0 && (
          <div className={classes.form}>
            <TextField
              autoFocus
              required
              label="IMEI"
              placeholder="866610043650469"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\s/g, ''))}
              error={imei.length > 0 && !imeiValid}
              helperText={t('xmImeiHelp')}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <TextField
              label={t('sharedName')}
              placeholder="LEA-19-961"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label={t('xmTrackerSim')}
              placeholder="03001234567"
              value={simNumber}
              onChange={(e) => setSimNumber(e.target.value)}
              helperText={t('xmTrackerSimHelp')}
            />
            <FormControl>
              <InputLabel>{t('deviceModel')}</InputLabel>
              <Select
                label={t('deviceModel')}
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                {trackerModels.map((it) => (
                  <MenuItem key={it.id} value={it.id}>
                    {it.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        )}

        {step === 1 && (
          <div className={classes.form}>
            <div className={classes.serverInfo}>
              <Typography variant="body2" color="textSecondary">
                {t('xmServerAddress')}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {host}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('xmServerPort')}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {model.port}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                IMEI
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {device?.uniqueId}
              </Typography>
            </div>
            <Alert severity="info">{t('xmSmsInstructions')}</Alert>
            <CommandBox
              label={`1. ${t('xmCmdServer')}`}
              command={serverCommand}
              phone={simNumber.trim()}
            />
            <FormControl size="small" sx={{ maxWidth: 240 }}>
              <InputLabel>{t('xmSimOperator')}</InputLabel>
              <Select
                label={t('xmSimOperator')}
                value={apnId}
                onChange={(e) => setApnId(e.target.value)}
              >
                {apnPresets.map((it) => (
                  <MenuItem key={it.id} value={it.id}>
                    {it.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <CommandBox
              label={`2. ${t('xmCmdApn')}`}
              command={fillCommand(model.apnCommand, values)}
              phone={simNumber.trim()}
            />
            <CommandBox
              label={`3. ${t('xmCmdReset')}`}
              command={model.resetCommand}
              phone={simNumber.trim()}
            />
            <CommandBox
              label={`4. ${t('xmCmdCheck')}`}
              command={model.checkCommand}
              phone={simNumber.trim()}
            />
            <div className={classes.status}>
              {connected ? (
                <>
                  <CheckCircleIcon color="success" />
                  <Typography color="success.main" fontWeight={700}>
                    {t('xmDeviceConnected')}
                  </Typography>
                </>
              ) : (
                <>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="textSecondary">
                    {t('xmWaitingDevice')}
                  </Typography>
                </>
              )}
              <Chip size="small" label={model.protocol.toUpperCase()} sx={{ ml: 'auto' }} />
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {step === 0 ? (
          <>
            <Button onClick={close}>{t('sharedCancel')}</Button>
            <Button variant="contained" disabled={!imeiValid || saving} onClick={submit}>
              {t('xmSubmit')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={reset}>{t('xmAddAnother')}</Button>
            <Button variant="contained" onClick={close}>
              {t('xmDone')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default QuickAddDeviceDialog;
