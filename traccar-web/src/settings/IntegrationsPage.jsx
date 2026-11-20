import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import MapIcon from '@mui/icons-material/Map';
import KeyIcon from '@mui/icons-material/VpnKey';
import PaletteIcon from '@mui/icons-material/Palette';
import StraightenIcon from '@mui/icons-material/Straighten';
import DnsIcon from '@mui/icons-material/Dns';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import PasswordField from '../common/components/PasswordField';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import { sessionActions } from '../store';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useAdministrator } from '../common/util/permissions';
import useMapStyles, { defaultActiveMapStyles } from '../map/core/useMapStyles';
import { brand } from '../common/theme/palette';

const providers = [
  {
    attribute: 'googleKey',
    name: 'Google Maps',
    url: 'https://console.cloud.google.com/google/maps-apis/credentials',
    help: 'Map Tiles API key. Without a key, basic Google tiles are used.',
  },
  {
    attribute: 'mapboxAccessToken',
    name: 'Mapbox',
    url: 'https://account.mapbox.com/access-tokens/',
  },
  {
    attribute: 'mapTilerKey',
    name: 'MapTiler',
    url: 'https://cloud.maptiler.com/account/keys/',
  },
  {
    attribute: 'bingMapsKey',
    name: 'Bing Maps',
    url: 'https://www.bingmapsportal.com/',
  },
  {
    attribute: 'tomTomKey',
    name: 'TomTom',
    url: 'https://developer.tomtom.com/',
  },
  {
    attribute: 'hereKey',
    name: 'HERE',
    url: 'https://platform.here.com/admin/apps',
  },
  {
    attribute: 'locationIqKey',
    name: 'LocationIQ',
    url: 'https://my.locationiq.com/',
    help: 'Optional. A shared demo key is used when empty.',
  },
];

const hexColor = /^#([0-9A-Fa-f]{3}){1,2}$/;

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing(2),
  },
  provider: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  },
  providerTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  maps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    padding: 0,
    cursor: 'pointer',
  },
  footer: {
    position: 'sticky',
    bottom: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 0),
    backgroundColor: theme.palette.background.default,
  },
}));

const ColorField = ({ label, value, fallback, onChange }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.colorRow}>
      <input
        type="color"
        className={classes.swatch}
        value={hexColor.test(value || '') ? value : fallback}
        onChange={(e) => onChange(e.target.value)}
      />
      <TextField
        fullWidth
        label={label}
        value={value || ''}
        placeholder={fallback}
        error={Boolean(value) && !hexColor.test(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

const IntegrationsPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();
  const admin = useAdministrator();

  const original = useSelector((state) => state.session.server);
  const [item, setItem] = useState(() => ({
    ...original,
    attributes: { ...original.attributes },
  }));
  const [saved, setSaved] = useState(false);

  const mapStyles = useMapStyles();

  const attributes = item.attributes || {};
  const setAttribute = (key, value) => {
    const updated = { ...attributes };
    if (value === '' || value === null || value === undefined) {
      delete updated[key];
    } else {
      updated[key] = value;
    }
    setItem({ ...item, attributes: updated });
  };

  const activeMaps = (attributes.activeMapStyles || defaultActiveMapStyles).split(',');
  const toggleMap = (id) => {
    const next = activeMaps.includes(id)
      ? activeMaps.filter((it) => it !== id)
      : [...activeMaps, id];
    setAttribute('activeMapStyles', next.join(','));
  };

  // A paid map becomes usable once its key is entered on this page.
  const isUsable = (style) =>
    style.available || (style.attribute && Boolean(attributes[style.attribute]));

  const handleSave = useCatch(async () => {
    const response = await fetchOrThrow('api/server', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    dispatch(sessionActions.updateServer(await response.json()));
    setSaved(true);
  });

  if (!admin) {
    return null;
  }

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'xmApiSettings']}>
      <Container maxWidth="lg" className={classes.container}>
        <Alert severity="info">{t('xmApiSettingsHelp')}</Alert>

        <Card variant="outlined">
          <CardHeader
            className={classes.header}
            avatar={<KeyIcon />}
            title={t('xmMapProviders')}
            subheader={t('xmPaidMaps')}
          />
          <CardContent className={classes.grid}>
            {providers.map((provider) => {
              const configured = Boolean(attributes[provider.attribute]);
              return (
                <div key={provider.attribute} className={classes.provider}>
                  <div className={classes.providerTitle}>
                    <Typography fontWeight={700}>{provider.name}</Typography>
                    <Chip
                      size="small"
                      label={configured ? 'Configured' : 'Not set'}
                      color={configured ? 'success' : 'default'}
                      variant={configured ? 'filled' : 'outlined'}
                    />
                  </div>
                  <PasswordField
                    label="API key"
                    value={attributes[provider.attribute] || ''}
                    onChange={(e) => setAttribute(provider.attribute, e.target.value.trim())}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {provider.help ? `${provider.help} ` : ''}
                    <Link href={provider.url} target="_blank" rel="noopener">
                      Get key
                    </Link>
                  </Typography>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader className={classes.header} avatar={<MapIcon />} title={t('xmEnabledMaps')} />
          <CardContent>
            <FormControl sx={{ minWidth: 280, mb: 2 }}>
              <InputLabel>{t('xmDefaultMap')}</InputLabel>
              <Select
                label={t('xmDefaultMap')}
                value={item.map || 'openFreeMap'}
                onChange={(e) => setItem({ ...item, map: e.target.value })}
              >
                {mapStyles.filter(isUsable).map((style) => (
                  <MenuItem key={style.id} value={style.id}>
                    {style.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {['free', 'paid'].map((category) => (
              <Box key={category} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  {category === 'free' ? t('xmFreeMaps') : t('xmPaidMaps')}
                </Typography>
                <div className={classes.maps}>
                  {mapStyles
                    .filter((style) => style.category === category && style.id !== 'custom')
                    .map((style) => {
                      const usable = isUsable(style);
                      return (
                        <FormControlLabel
                          key={style.id}
                          disabled={!usable}
                          control={
                            <Checkbox
                              size="small"
                              checked={usable && activeMaps.includes(style.id)}
                              onChange={() => toggleMap(style.id)}
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {style.title}
                              {!usable && (
                                <Typography component="span" variant="caption" color="error">
                                  {` (${t('xmNeedsKey')})`}
                                </Typography>
                              )}
                            </Typography>
                          }
                        />
                      );
                    })}
                </div>
              </Box>
            ))}
            <TextField
              fullWidth
              sx={{ mt: 1 }}
              label={t('mapCustomLabel')}
              helperText="https://example.com/tiles/{z}/{x}/{y}.png"
              value={item.mapUrl || ''}
              onChange={(e) => setItem({ ...item, mapUrl: e.target.value })}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader
            className={classes.header}
            avatar={<StraightenIcon />}
            title={t('sharedPreferences')}
          />
          <CardContent className={classes.grid}>
            <FormControl>
              <InputLabel>{t('settingsSpeedUnit')}</InputLabel>
              <Select
                label={t('settingsSpeedUnit')}
                value={attributes.speedUnit || 'kmh'}
                onChange={(e) => setAttribute('speedUnit', e.target.value)}
              >
                <MenuItem value="kmh">{t('sharedKmh')}</MenuItem>
                <MenuItem value="mph">{t('sharedMph')}</MenuItem>
                <MenuItem value="kn">{t('sharedKn')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel>{t('settingsDistanceUnit')}</InputLabel>
              <Select
                label={t('settingsDistanceUnit')}
                value={attributes.distanceUnit || 'km'}
                onChange={(e) => setAttribute('distanceUnit', e.target.value)}
              >
                <MenuItem value="km">{t('sharedKm')}</MenuItem>
                <MenuItem value="mi">{t('sharedMi')}</MenuItem>
                <MenuItem value="nmi">{t('sharedNmi')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('sharedTimezone')}
              placeholder="Asia/Karachi"
              value={attributes.timezone || ''}
              onChange={(e) => setAttribute('timezone', e.target.value)}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader className={classes.header} avatar={<PaletteIcon />} title={t('xmBranding')} />
          <CardContent className={classes.grid}>
            <TextField
              label={t('xmAppTitle')}
              placeholder="XMart Track"
              value={attributes.title || ''}
              onChange={(e) => setAttribute('title', e.target.value)}
            />
            <TextField
              label="Logo URL"
              value={attributes.logo || ''}
              onChange={(e) => setAttribute('logo', e.target.value)}
            />
            <ColorField
              label={t('xmPrimaryColor')}
              value={attributes.colorPrimary}
              fallback={brand.teal}
              onChange={(value) => setAttribute('colorPrimary', value)}
            />
            <ColorField
              label={t('xmNavColor')}
              value={attributes.colorNav}
              fallback={brand.tealDark}
              onChange={(value) => setAttribute('colorNav', value)}
            />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader className={classes.header} avatar={<DnsIcon />} title={t('settingsServer')} />
          <CardContent>
            <Typography variant="body2" gutterBottom>
              {`${t('xmGeocoding')}: `}
              <Chip
                size="small"
                label={original.geocoderEnabled ? t('xmEnabled') : t('xmDisabled')}
                color={original.geocoderEnabled ? 'success' : 'default'}
              />
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Address lookup, SMS gateway, email (SMTP) and push notifications are configured in the
              server config file (conf/traccar.xml). The installer will ask for these values.
            </Typography>
            <Button sx={{ mt: 1 }} onClick={() => navigate('/settings/server')}>
              {t('settingsServer')} →
            </Button>
          </CardContent>
        </Card>

        <div className={classes.footer}>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            {t('sharedCancel')}
          </Button>
          <Button variant="contained" onClick={handleSave}>
            {t('sharedSave')}
          </Button>
        </div>
      </Container>
      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        message={t('xmSaved')}
      />
    </PageLayout>
  );
};

export default IntegrationsPage;
