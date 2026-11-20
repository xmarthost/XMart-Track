import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Badge, ButtonBase, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import BarChartIcon from '@mui/icons-material/BarChart';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2';
import PeopleIcon from '@mui/icons-material/People';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useTranslation } from '../LocalizationProvider';
import { useAdministrator, useManager, useRestriction } from '../../util/permissions';

export const RAIL_WIDTH = 84;

const useStyles = makeStyles()((theme) => ({
  root: {
    width: RAIL_WIDTH,
    minWidth: RAIL_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingTop: theme.spacing(1),
    backgroundColor: theme.palette.nav.main,
    color: theme.palette.nav.contrastText,
    overflowY: 'auto',
    zIndex: 9,
    '@media print': {
      display: 'none',
    },
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5, 0.5),
    color: 'rgba(255, 255, 255, 0.72)',
    borderLeft: '3px solid transparent',
    transition: 'background-color 120ms, color 120ms',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      color: '#FFFFFF',
    },
  },
  active: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderLeftColor: '#4ADE80',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    textAlign: 'center',
    lineHeight: 1.2,
  },
}));

const NavRail = () => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation();

  const admin = useAdministrator();
  const manager = useManager();
  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const socket = useSelector((state) => state.session.socket);
  const eventCount = useSelector((state) => state.events.items.length);

  const { pathname } = location;

  const items = [
    {
      key: 'monitor',
      label: t('xmMonitor'),
      icon: (
        <Badge color="error" variant="dot" invisible={socket !== false}>
          <DesktopWindowsIcon />
        </Badge>
      ),
      path: '/',
      active:
        pathname === '/' || pathname.startsWith('/replay') || pathname.startsWith('/position'),
    },
    !disableReports && {
      key: 'statistics',
      label: t('xmStatistics'),
      icon: <BarChartIcon />,
      path: selectedDeviceId
        ? `/reports/combined?deviceId=${selectedDeviceId}`
        : '/reports/combined',
      active: pathname.startsWith('/reports'),
    },
    !readonly && {
      key: 'geofences',
      label: t('sharedGeofences'),
      icon: <HexagonOutlinedIcon />,
      path: '/geofences',
      active: pathname.startsWith('/geofence') || pathname.startsWith('/settings/geofence'),
    },
    !readonly && {
      key: 'manage',
      label: t('xmManage'),
      icon: <InventoryIcon />,
      path: '/settings/devices',
      active:
        pathname.startsWith('/settings') &&
        !pathname.startsWith('/settings/user') &&
        !pathname.startsWith('/settings/notification') &&
        !pathname.startsWith('/settings/integrations') &&
        !pathname.startsWith('/settings/server'),
    },
    manager && {
      key: 'customer',
      label: t('xmCustomer'),
      icon: <PeopleIcon />,
      path: '/settings/users',
      active: pathname.startsWith('/settings/user'),
    },
    !readonly && {
      key: 'alerts',
      label: t('xmAlerts'),
      icon: (
        <Badge color="error" badgeContent={eventCount} max={99}>
          <NotificationsActiveIcon />
        </Badge>
      ),
      path: '/settings/notifications',
      active: pathname.startsWith('/settings/notification'),
    },
    admin && {
      key: 'admin',
      label: t('xmAdmin'),
      icon: <AdminPanelSettingsIcon />,
      path: '/settings/integrations',
      active:
        pathname.startsWith('/settings/integrations') || pathname.startsWith('/settings/server'),
    },
  ].filter(Boolean);

  return (
    <nav className={classes.root}>
      {items.map((item) => (
        <ButtonBase
          key={item.key}
          className={cx(classes.item, item.active && classes.active)}
          onClick={() => navigate(item.path)}
        >
          {item.icon}
          <Typography className={classes.label}>{item.label}</Typography>
        </ButtonBase>
      ))}
    </nav>
  );
};

export default NavRail;
