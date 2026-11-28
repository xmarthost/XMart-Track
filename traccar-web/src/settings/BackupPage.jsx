import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Container,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';

const useStyles = makeStyles()((theme) => ({
  container: {
    marginTop: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

const sizeText = (bytes) =>
  bytes > 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Export the whole server (vehicles, history, users, alerts, geofences, settings) to one file and
// import it on a new server.
const BackupPage = () => {
  const { classes } = useStyles();
  const fileRef = useRef(null);
  const [history, setHistory] = useState(true);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [server, setServer] = useState(null);
  const [days, setDays] = useState('0');
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('api/server', { signal: controller.signal })
      .then((response) => response.json())
      .then((value) => {
        setServer(value);
        setDays(String(value.attributes?.['xm.historyDays'] || 0));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const saveRetention = async () => {
    setSaved(null);
    const attributes = { ...(server.attributes || {}) };
    if (Number(days) > 0) attributes['xm.historyDays'] = Number(days);
    else delete attributes['xm.historyDays'];
    const response = await fetch('api/server', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...server, attributes }),
    });
    if (response.ok) {
      setServer(await response.json());
      setSaved({
        severity: 'success',
        text: 'Saved. Older history is deleted automatically every 6 hours.',
      });
    } else {
      setSaved({ severity: 'error', text: `Save failed (${response.status})` });
    }
  };

  const runImport = () => {
    if (!file) return;
    const ok = window.confirm(
      'Import replaces EVERYTHING on this server (vehicles, history, users, alerts, settings) with the backup. ' +
        'The server restarts and everybody has to log in again with the accounts from the backup. Continue?',
    );
    if (!ok) return;
    setResult(null);
    setProgress(0);
    const request = new XMLHttpRequest();
    request.open('POST', 'api/xmart/backup');
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.onprogress = (e) =>
      e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    request.onload = () => {
      setProgress(null);
      if (request.status === 200) {
        setResult({
          severity: 'success',
          text: 'Backup imported. The server is restarting: wait one minute, then log in with an account from the backup.',
        });
        setTimeout(() => window.location.reload(), 60000);
      } else {
        let text = request.responseText;
        try {
          text = JSON.parse(request.responseText).error || text;
        } catch {
          // plain text error
        }
        setResult({ severity: 'error', text: `Import failed (${request.status}): ${text}` });
      }
    };
    request.onerror = () => {
      setProgress(null);
      setResult({ severity: 'error', text: 'Upload failed. Check the connection and try again.' });
    };
    request.send(file);
  };

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'xmBackup']}>
      <Container maxWidth="md" className={classes.container}>
        <Alert severity="info">
          Move XMart Track to another server: export a backup here, install XMart Track on the new
          server, then import the backup there. Vehicles, location history, users, alerts, geofences
          and all settings are included.
        </Alert>

        <Card>
          <CardHeader
            title="Export backup"
            subheader="Downloads one file (.sql.gz) with all data of this server."
          />
          <CardContent>
            <FormControlLabel
              control={
                <Checkbox checked={history} onChange={(e) => setHistory(e.target.checked)} />
              }
              label="Include location history (playback, reports). Without it the file is much smaller."
            />
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                href={`api/xmart/backup?history=${history}`}
              >
                Export backup
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Large servers can take a few minutes; the download starts when the file is ready. Keep
              the file safe: it contains all accounts and data.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Keep location history"
            subheader="Older positions and events are deleted automatically so the disk never fills up. The latest position of every vehicle is always kept."
          />
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                select
                size="small"
                label="Keep history for"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="0">Forever (never delete)</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="60">60 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
                <MenuItem value="180">6 months</MenuItem>
                <MenuItem value="365">1 year</MenuItem>
              </TextField>
              <Button variant="contained" onClick={saveRetention} disabled={!server}>
                Save
              </Button>
            </Box>
            {saved && (
              <Alert severity={saved.severity} sx={{ mt: 2 }}>
                {saved.text}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Import backup"
            subheader="On the new server: replaces all data with the backup file."
          />
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".gz,.sql,application/gzip"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => fileRef.current?.click()}
                disabled={progress !== null}
              >
                Choose backup file
              </Button>
              <Typography variant="body2">
                {file ? `${file.name} (${sizeText(file.size)})` : 'No file chosen'}
              </Typography>
            </Box>
            {progress !== null && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant={progress < 100 ? 'determinate' : 'indeterminate'}
                  value={progress}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {progress < 100
                    ? `Uploading ${progress}%`
                    : 'Importing into the database… do not close this page'}
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="error"
                startIcon={<UploadIcon />}
                disabled={!file || progress !== null}
                onClick={runImport}
              >
                Import and replace all data
              </Button>
            </Box>
            {result && (
              <Alert severity={result.severity} sx={{ mt: 2 }}>
                {result.text}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Container>
    </PageLayout>
  );
};

export default BackupPage;
