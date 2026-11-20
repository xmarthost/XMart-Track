import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Avatar, Button, ButtonBase, IconButton, Paper, Toolbar, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SensorsIcon from '@mui/icons-material/Sensors';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import BarChartIcon from '@mui/icons-material/BarChart';
import SmsIcon from '@mui/icons-material/Sms';
import BackIcon from '../common/components/BackIcon';
import { useTranslation } from '../common/components/LocalizationProvider';
import { formatTime } from '../common/util/formatter';
import TrackerSmsDialog from '../common/components/xmart/TrackerSmsDialog';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
    overflowY: 'auto',
  },
  head: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(2),
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: theme.palette.primary.main,
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    padding: theme.spacing(1, 1, 2),
  },
  action: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    borderRadius: 12,
    padding: theme.spacing(0.5),
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.primary.main,
  },
  list: {
    margin: theme.spacing(1.5),
    borderRadius: 12,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
}));

const DeviceMorePage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();
  const { id } = useParams();
  const deviceId = Number(id);
  const device = useSelector((state) => state.devices.items[deviceId]);
  const group = useSelector((state) =>
    device?.groupId ? state.groups.items[device.groupId] : null,
  );
  const [trackerSms, setTrackerSms] = useState(false);

  if (!device) {
    return null;
  }

  const statusLabel = {
    online: t('xmOnline'),
    offline: t('xmOffline'),
    unknown: t('xmInactive'),
  }[device.status];

  const rows = [
    [t('deviceModel'), device.model || '--'],
    [t('deviceStatus'), statusLabel],
    [t('xmLastUpdate'), formatTime(device.lastUpdate) || '--'],
    [t('xmExpiry'), device.expirationTime ? formatTime(device.expirationTime, 'date') : '--'],
    [t('xmTrackerSim'), device.phone || '--'],
    [t('settingsGroups'), group?.name || t('xmUngrouped')],
    [t('deviceContact'), device.contact || '--'],
  ];

  const actions = [
    {
      key: 'vehicle',
      label: t('xmVehicle'),
      icon: <DirectionsCarIcon />,
      onClick: () => navigate(`/settings/device/${deviceId}`),
    },
    {
      key: 'alarm',
      label: t('xmAlarmSetting'),
      icon: <SettingsSuggestIcon />,
      onClick: () => navigate('/settings/sms-alerts'),
    },
    {
      key: 'tracker',
      label: t('xmTrackerSms'),
      icon: <SmsIcon />,
      onClick: () => setTrackerSms(true),
    },
    {
      key: 'report',
      label: t('xmDataReport'),
      icon: <BarChartIcon />,
      onClick: () => navigate(`/reports/combined?deviceId=${deviceId}`),
    },
  ];

  return (
    <div className={classes.root}>
      <Paper square elevation={0}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, textAlign: 'center', mr: 5 }}>
            {t('xmMore')}
          </Typography>
        </Toolbar>
        <div className={classes.head}>
          <Avatar className={classes.avatar}>
            <SensorsIcon fontSize="large" />
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {device.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {`IMEI ${device.uniqueId}`}
              <Button size="small" onClick={() => navigator.clipboard?.writeText(device.uniqueId)}>
                {t('xmCopy')}
              </Button>
            </Typography>
          </div>
        </div>
        <div className={classes.actions}>
          {actions.map((action) => (
            <ButtonBase key={action.key} className={classes.action} onClick={action.onClick}>
              <span className={classes.actionIcon}>{action.icon}</span>
              <Typography variant="caption" align="center" color="textSecondary">
                {action.label}
              </Typography>
            </ButtonBase>
          ))}
        </div>
      </Paper>
      <Paper elevation={0} className={classes.list}>
        {rows.map(([label, value]) => (
          <div key={label} className={classes.row}>
            <Typography>{label}</Typography>
            <Typography color="textSecondary" align="right">
              {value}
            </Typography>
          </div>
        ))}
      </Paper>
      <TrackerSmsDialog
        deviceId={trackerSms ? deviceId : null}
        onClose={() => setTrackerSms(false)}
      />
    </div>
  );
};

export default DeviceMorePage;
