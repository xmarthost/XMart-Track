import { useState } from 'react';
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
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useTranslation } from '../LocalizationProvider';
import { useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';
import { CommandBox } from './QuickAddDeviceDialog';
import { fillCommand, trackerModels } from './trackerModels';

const g19s = trackerModels[0];

const cleanNumber = (value) => value.replace(/[^\d+]/g, '');

// Configures the alarm SMS the tracker sends from its own SIM card
// (commands from the WanWay G19S user manual).
const TrackerSmsDialog = ({ deviceId, onClose }) => {
  const t = useTranslation();
  const device = useSelector((state) => (deviceId ? state.devices.items[deviceId] : null));

  const [center, setCenter] = useState('');
  const [sos, setSos] = useState(['', '', '']);
  const [result, setResult] = useState(null);

  const online = device?.status === 'online';
  const trackerSim = device?.phone || '';
  const sosNumbers = sos.map(cleanNumber).filter(Boolean);

  const sendOnline = useCatch(async (data) => {
    const response = await fetchOrThrow('api/commands/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, type: 'custom', attributes: { data } }),
    });
    setResult(response.status === 202 ? t('xmCommandQueued') : t('xmCommandSent'));
  });

  const commands = [
    {
      key: 'center',
      label: t('xmCenterNumber'),
      command: center ? fillCommand(g19s.centerCommand, { number: cleanNumber(center) }) : '',
    },
    {
      key: 'sos',
      label: t('xmSosNumbers'),
      command: sosNumbers.length
        ? fillCommand(g19s.sosCommand, { numbers: sosNumbers.join(',') })
        : '',
    },
    { key: 'accOn', label: t('xmAccSmsOn'), command: 'ACCALM,ON,1#' },
    { key: 'accOff', label: t('xmAccSmsOff'), command: 'ACCALM,OFF#' },
    { key: 'status', label: t('xmCmdCheck'), command: g19s.statusCommand },
    { key: 'location', label: t('xmCmdLocation'), command: g19s.locationCommand },
  ].filter((item) => item.command);

  return (
    <>
      <Dialog open={Boolean(deviceId)} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('xmTrackerSms')}
          <Typography variant="body2" color="textSecondary">
            {device?.name}
            {trackerSim ? ` • SIM ${trackerSim}` : ''}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info">{t('xmTrackerSmsHelp')}</Alert>
          {!trackerSim && <Alert severity="warning">{t('xmTrackerSimMissing')}</Alert>}
          <TextField
            label={t('xmCenterNumber')}
            placeholder="03001234567"
            helperText={t('xmCenterNumberHelp')}
            value={center}
            onChange={(e) => setCenter(e.target.value)}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {sos.map((value, index) => (
              <TextField
                key={index}
                size="small"
                label={`SOS ${index + 1}`}
                placeholder="03001234567"
                value={value}
                onChange={(e) =>
                  setSos(sos.map((item, i) => (i === index ? e.target.value : item)))
                }
              />
            ))}
          </Box>
          <Typography variant="caption" color="textSecondary">
            {t('xmSosHelp')}
          </Typography>
          {commands.map((item) => (
            <Box key={item.key} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <CommandBox label={item.label} command={item.command} phone={trackerSim} />
              </Box>
              <Tooltip title={online ? t('xmSendOnline') : t('xmSendOnlineOffline')}>
                <span>
                  <IconButton
                    color="primary"
                    disabled={!online}
                    onClick={() => sendOnline(item.command)}
                    sx={{ mb: 0.75 }}
                  >
                    <CloudUploadIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={onClose}>
            {t('xmDone')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(result)}
        autoHideDuration={4000}
        onClose={() => setResult(null)}
        message={result}
      />
    </>
  );
};

export default TrackerSmsDialog;
