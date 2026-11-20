import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Divider,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import TuneIcon from '@mui/icons-material/Tune';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useLocalization, useTranslation } from '../LocalizationProvider';
import { useAdministrator, useManager, useRestriction } from '../../util/permissions';
import { devicesActions, sessionActions } from '../../../store';
import { useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';
import useLogout from '../../util/useLogout';
import xmartIcon from '../../../resources/images/xmart-icon.png';

export const HEADER_HEIGHT = 56;

const useStyles = makeStyles()((theme) => ({
  root: {
    height: HEADER_HEIGHT,
    minHeight: HEADER_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 2),
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    zIndex: 10,
    '@media print': {
      display: 'none',
    },
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    minWidth: 180,
    userSelect: 'none',
  },
  brandIcon: {
    width: 34,
    height: 34,
  },
  brandText: {
    fontWeight: 800,
    fontSize: '1.25rem',
    letterSpacing: '-0.02em',
    color: theme.palette.text.primary,
    '& span': {
      color: theme.palette.primary.main,
    },
  },
  label: {
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
  },
  customer: {
    width: 220,
  },
  search: {
    width: 360,
    flexShrink: 1,
    minWidth: 200,
  },
  spacer: {
    flex: 1,
  },
  user: {
    textTransform: 'none',
    color: theme.palette.text.primary,
  },
  avatar: {
    width: 32,
    height: 32,
    backgroundColor: theme.palette.primary.main,
    fontSize: '0.9rem',
  },
}));

const CustomerSelector = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();
  const customer = useSelector((state) => state.devices.customer);
  const [users, setUsers] = useState(null);

  const loadUsers = useCatch(async () => {
    if (users === null) {
      const response = await fetchOrThrow('api/users');
      setUsers(await response.json());
    }
  });

  const selectCustomer = useCatch(async (user) => {
    if (!user) {
      dispatch(devicesActions.setCustomer(null));
      return;
    }
    const response = await fetchOrThrow(`api/devices?userId=${user.id}`);
    const items = await response.json();
    dispatch(
      devicesActions.setCustomer({
        userId: user.id,
        name: user.name,
        deviceIds: items.map((it) => it.id),
      }),
    );
  });

  return (
    <Autocomplete
      className={classes.customer}
      size="small"
      options={users || []}
      loading={users === null}
      onOpen={loadUsers}
      value={customer ? { id: customer.userId, name: customer.name } : null}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      getOptionLabel={(option) => option.name || ''}
      getOptionKey={(option) => option.id}
      onChange={(_, value) => selectCustomer(value)}
      renderInput={(params) => <TextField {...params} placeholder={t('xmAllCustomers')} />}
    />
  );
};

const DeviceSearch = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const options = useMemo(
    () => Object.values(devices).sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  );

  return (
    <Autocomplete
      className={classes.search}
      size="small"
      options={options}
      value={null}
      blurOnSelect
      clearOnBlur
      getOptionLabel={(option) => option.name}
      getOptionKey={(option) => option.id}
      filterOptions={(items, { inputValue }) => {
        const keyword = inputValue.toLowerCase();
        return items
          .filter((d) =>
            [d.name, d.uniqueId, d.phone, d.contact].some(
              (s) => s && s.toLowerCase().includes(keyword),
            ),
          )
          .slice(0, 50);
      }}
      renderOption={({ key, ...props }, option) => (
        <li key={key} {...props}>
          <Box>
            <Typography variant="body2">{option.name}</Typography>
            <Typography variant="caption" color="textSecondary">
              {option.uniqueId}
              {option.phone ? ` • ${option.phone}` : ''}
            </Typography>
          </Box>
        </li>
      )}
      onChange={(_, value) => {
        if (value) {
          dispatch(devicesActions.selectId(value.id));
          navigate('/');
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={t('xmSearchPlaceholder')}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
};

const LanguageSelector = () => {
  const dispatch = useDispatch();
  const { languages, language, setLocalLanguage } = useLocalization();
  const user = useSelector((state) => state.session.user);
  const serverLanguage = useSelector((state) => state.session.server.attributes.language);

  const changeLanguage = useCatch(async (value) => {
    setLocalLanguage(value);
    const response = await fetchOrThrow(`api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, attributes: { ...user.attributes, language: value } }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  });

  if (serverLanguage || user.readonly) {
    return null;
  }
  return (
    <Select
      size="small"
      value={language}
      onChange={(e) => changeLanguage(e.target.value)}
      sx={{ minWidth: 130 }}
    >
      {Object.entries(languages).map(([code, { name }]) => (
        <MenuItem key={code} value={code}>
          {name}
        </MenuItem>
      ))}
    </Select>
  );
};

const UserMenu = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const logout = useLogout();
  const admin = useAdministrator();
  const readonly = useRestriction('readonly');
  const user = useSelector((state) => state.session.user);
  const [anchorEl, setAnchorEl] = useState(null);

  const go = (path) => {
    setAnchorEl(null);
    navigate(path);
  };

  return (
    <>
      <Button
        className={classes.user}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<KeyboardArrowDownIcon />}
      >
        <Avatar className={classes.avatar}>{(user.name || '?').charAt(0).toUpperCase()}</Avatar>
        <Box component="span" sx={{ ml: 1, display: { xs: 'none', lg: 'inline' } }}>
          {user.name}
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {!readonly && (
          <MenuItem onClick={() => go(`/settings/user/${user.id}`)}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            {t('settingsUser')}
          </MenuItem>
        )}
        <MenuItem onClick={() => go('/settings/preferences')}>
          <ListItemIcon>
            <TuneIcon fontSize="small" />
          </ListItemIcon>
          {t('sharedPreferences')}
        </MenuItem>
        {!readonly && (
          <MenuItem onClick={() => go('/settings/notifications')}>
            <ListItemIcon>
              <NotificationsIcon fontSize="small" />
            </ListItemIcon>
            {t('sharedNotifications')}
          </MenuItem>
        )}
        {admin && (
          <MenuItem onClick={() => go('/settings/integrations')}>
            <ListItemIcon>
              <AdminPanelSettingsIcon fontSize="small" />
            </ListItemIcon>
            {t('xmApiSettings')}
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" color="error" />
          </ListItemIcon>
          <Typography color="error">{t('loginLogout')}</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

const AppHeader = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const manager = useManager();
  const readonly = useRestriction('readonly');
  const title = useSelector((state) => state.session.server.attributes.title);

  return (
    <header className={classes.root}>
      <div className={classes.brand} onClick={() => navigate('/')}>
        <img className={classes.brandIcon} src={xmartIcon} alt="" />
        {title ? (
          <Typography className={classes.brandText}>{title}</Typography>
        ) : (
          <Typography className={classes.brandText}>
            XMart <span>Track</span>
          </Typography>
        )}
      </div>
      {manager && (
        <>
          <Typography variant="body2" className={classes.label}>
            {t('xmCurrentCustomer')}
          </Typography>
          <CustomerSelector />
        </>
      )}
      <div className={classes.spacer} />
      <DeviceSearch />
      {!readonly && (
        <Button variant="outlined" onClick={() => navigate('/settings/devices')}>
          {t('deviceTitle')}
        </Button>
      )}
      {manager && (
        <Button variant="outlined" onClick={() => navigate('/settings/users')}>
          {t('xmCustomer')}
        </Button>
      )}
      <LanguageSelector />
      <UserMenu />
    </header>
  );
};

export default AppHeader;
