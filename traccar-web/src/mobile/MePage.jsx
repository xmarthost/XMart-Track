import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SecurityIcon from '@mui/icons-material/Security';
import TranslateIcon from '@mui/icons-material/Translate';
import SmsIcon from '@mui/icons-material/Sms';
import NotificationsIcon from '@mui/icons-material/Notifications';
import StraightenIcon from '@mui/icons-material/Straighten';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import InventoryIcon from '@mui/icons-material/Inventory2';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useState } from 'react';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { useAdministrator, useRestriction } from '../common/util/permissions';
import useLogout from '../common/util/useLogout';
import QuickAddDeviceDialog from '../common/components/xmart/QuickAddDeviceDialog';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    overflowY: 'auto',
    backgroundColor: theme.palette.background.default,
  },
  hero: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(5, 3, 4),
    paddingTop: `calc(${theme.spacing(5)} + env(safe-area-inset-top))`,
    color: '#fff',
    background: `linear-gradient(135deg, ${theme.palette.nav.main} 0%, ${theme.palette.primary.main} 100%)`,
  },
  avatar: {
    width: 72,
    height: 72,
    fontSize: '2rem',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  card: {
    margin: theme.spacing(1.5),
    borderRadius: 12,
    overflow: 'hidden',
  },
  icon: {
    minWidth: 40,
    color: theme.palette.primary.main,
  },
}));

const MePage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const logout = useLogout();
  const admin = useAdministrator();
  const readonly = useRestriction('readonly');
  const { languages, language, setLocalLanguage } = useLocalization();
  const user = useSelector((state) => state.session.user);
  const [addOpen, setAddOpen] = useState(false);

  const item = (key, icon, label, onClick, extra) => (
    <ListItemButton key={key} divider onClick={onClick}>
      <ListItemIcon className={classes.icon}>{icon}</ListItemIcon>
      <ListItemText primary={label} />
      {extra || <ChevronRightIcon color="action" />}
    </ListItemButton>
  );

  return (
    <div className={classes.root}>
      <div className={classes.hero}>
        <Avatar className={classes.avatar}>{(user.name || '?').charAt(0).toUpperCase()}</Avatar>
        <div>
          <Typography variant="h5" fontWeight={700}>
            {user.name}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            {user.email}
          </Typography>
        </div>
      </div>
      <Paper elevation={0} className={classes.card}>
        <List disablePadding>
          {item('overview', <DashboardIcon />, t('xmFleetOverview'), () =>
            navigate('/reports/dashboard'),
          )}
          {item('reports', <AssessmentIcon />, t('reportTitle'), () =>
            navigate('/reports/combined'),
          )}
          {!readonly && item('add', <AddCircleIcon />, t('xmAddDevice'), () => setAddOpen(true))}
          {!readonly &&
            item('devices', <InventoryIcon />, t('deviceTitle'), () =>
              navigate('/settings/devices'),
            )}
          {!readonly &&
            item('geofences', <HexagonOutlinedIcon />, t('sharedGeofences'), () =>
              navigate('/geofences'),
            )}
        </List>
      </Paper>
      <Paper elevation={0} className={classes.card}>
        <List disablePadding>
          {!readonly &&
            item('sms', <SmsIcon />, t('xmSmsAlerts'), () => navigate('/settings/sms-alerts'))}
          {!readonly &&
            item('push', <NotificationsIcon />, t('sharedNotifications'), () =>
              navigate('/settings/notifications'),
            )}
          {item(
            'language',
            <TranslateIcon />,
            t('xmLanguage'),
            undefined,
            <Select
              size="small"
              variant="standard"
              value={language}
              onChange={(e) => setLocalLanguage(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              {Object.entries(languages).map(([code, { name }]) => (
                <MenuItem key={code} value={code}>
                  {name}
                </MenuItem>
              ))}
            </Select>,
          )}
          {item('units', <StraightenIcon />, t('sharedPreferences'), () =>
            navigate('/settings/preferences'),
          )}
          {!readonly &&
            item('security', <SecurityIcon />, t('xmAccountSecurity'), () =>
              navigate(`/settings/user/${user.id}`),
            )}
          {admin &&
            item('admin', <AdminPanelSettingsIcon />, t('xmApiSettings'), () =>
              navigate('/settings/integrations'),
            )}
        </List>
      </Paper>
      <Paper elevation={0} className={classes.card}>
        <List disablePadding>
          <ListItemButton onClick={logout}>
            <ListItemIcon className={classes.icon}>
              <LogoutIcon color="error" />
            </ListItemIcon>
            <ListItemText primary={t('loginLogout')} slotProps={{ primary: { color: 'error' } }} />
          </ListItemButton>
        </List>
      </Paper>
      <QuickAddDeviceDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
};

export default MePage;
