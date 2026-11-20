import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Badge, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import { useTranslation } from '../common/components/LocalizationProvider';

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useTranslation();
  const socket = useSelector((state) => state.session.socket);
  const eventCount = useSelector((state) => state.events.items.length);

  let value = null;
  if (pathname === '/') value = 'monitor';
  else if (pathname.startsWith('/events')) value = 'alarm';
  else if (pathname.startsWith('/me')) value = 'me';

  return (
    <Paper square elevation={8} sx={{ pb: 'env(safe-area-inset-bottom)' }}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_, next) => navigate({ monitor: '/', alarm: '/events', me: '/me' }[next])}
      >
        <BottomNavigationAction
          value="monitor"
          label={t('xmMonitor')}
          icon={
            <Badge color="error" variant="dot" invisible={socket !== false}>
              <DesktopWindowsIcon />
            </Badge>
          }
        />
        <BottomNavigationAction
          value="alarm"
          label={t('xmAlerts')}
          icon={
            <Badge color="error" badgeContent={eventCount} max={99}>
              <NotificationsIcon />
            </Badge>
          }
        />
        <BottomNavigationAction value="me" label={t('xmMe')} icon={<PersonIcon />} />
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNav;
