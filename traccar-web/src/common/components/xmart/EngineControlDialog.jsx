import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { useTranslation } from '../LocalizationProvider';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';

// action: 'engineStop' | 'engineResume' | null (closed)
const EngineControlDialog = ({ deviceId, action, onClose }) => {
  const t = useTranslation();
  const device = useSelector((state) => state.devices.items[deviceId]);
  const [supported, setSupported] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      setSupported(null);
      if (deviceId && action) {
        const response = await fetchOrThrow(`api/commands/types?deviceId=${deviceId}`, { signal });
        const types = await response.json();
        setSupported(types.some((it) => it.type === action));
      }
    },
    [deviceId, action],
  );

  const send = useCatch(async () => {
    setSending(true);
    try {
      const response = await fetchOrThrow('api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, type: action, attributes: {} }),
      });
      setResult(response.status === 202 ? 'queued' : 'sent');
      onClose();
    } finally {
      setSending(false);
    }
  });

  const stop = action === 'engineStop';

  return (
    <>
      <Dialog open={Boolean(action)} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PowerSettingsNewIcon color={stop ? 'error' : 'success'} />
          {stop ? t('xmEngineCut') : t('xmEngineRestore')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>
            {device?.name} ({device?.uniqueId})
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {stop ? t('xmEngineCutConfirm') : t('xmEngineRestoreConfirm')}
          </Typography>
          {supported === false && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('xmNotSupported')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('sharedCancel')}</Button>
          <Button
            variant="contained"
            color={stop ? 'error' : 'success'}
            disabled={sending || supported !== true}
            onClick={send}
          >
            {stop ? t('xmEngineCut') : t('xmEngineRestore')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(result)}
        autoHideDuration={4000}
        onClose={() => setResult(null)}
        message={result === 'queued' ? t('xmCommandQueued') : t('xmCommandSent')}
      />
    </>
  );
};

export default EngineControlDialog;
