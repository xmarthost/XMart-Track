import { useMemo, useState, useEffect, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { List } from 'react-window';
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  OutlinedInput,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import HistoryIcon from '@mui/icons-material/History';
import NearMeIcon from '@mui/icons-material/NearMe';
import TerminalIcon from '@mui/icons-material/Terminal';
import ArticleIcon from '@mui/icons-material/Article';
import EditIcon from '@mui/icons-material/Edit';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PowerIcon from '@mui/icons-material/Power';
import KeyIcon from '@mui/icons-material/VpnKey';
import ErrorIcon from '@mui/icons-material/Error';
import { devicesActions } from '../../store';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useDeviceReadonly, useRestriction } from '../../common/util/permissions';
import { useAttributePreference } from '../../common/util/preferences';
import usePersistedState from '../../common/util/usePersistedState';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { speedFromKnots, speedUnitString } from '../../common/util/converter';
import { getDeviceState, sinceNow, stateColors } from '../../common/util/xmartStatus';
import EngineControlDialog from '../../common/components/xmart/EngineControlDialog';
import QuickAddDeviceDialog from '../../common/components/xmart/QuickAddDeviceDialog';
import TrackerSmsDialog from '../../common/components/xmart/TrackerSmsDialog';
import SmsIcon from '@mui/icons-material/Sms';

const HEADER_ROW = 40;
const DEVICE_ROW = 52;

const tabStatuses = {
  all: [],
  online: ['online'],
  offline: ['offline'],
  inactive: ['unknown'],
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: theme.palette.background.paper,
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1.5, 0.5),
  },
  tabs: {
    minHeight: 40,
    borderBottom: `1px solid ${theme.palette.divider}`,
    '& .MuiTab-root': {
      minHeight: 40,
      minWidth: 0,
      padding: theme.spacing(0, 1.5),
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  toolsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '& .MuiFormControlLabel-label': {
      fontSize: '0.85rem',
    },
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  groupRow: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    cursor: 'pointer',
    fontWeight: 600,
    backgroundColor: theme.palette.action.hover,
    userSelect: 'none',
  },
  deviceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 0.5, 0, 1.5),
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  selected: {
    backgroundColor: `${theme.palette.primary.main}1F`,
    '&:hover': {
      backgroundColor: `${theme.palette.primary.main}29`,
    },
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  deviceText: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontWeight: 600,
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  deviceSub: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stateText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textAlign: 'right',
  },
  icons: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  empty: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

const DeviceStateText = ({ device, position }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const speedUnit = useAttributePreference('speedUnit', 'kmh');
  const state = getDeviceState(device, position);

  let text;
  switch (state) {
    case 'moving':
      text = position
        ? `${Math.round(speedFromKnots(position.speed, speedUnit))} ${speedUnitString(speedUnit, t)}`
        : t('xmMoving');
      break;
    case 'static':
      text = t('xmStatic');
      break;
    case 'offline':
      text = `${t('xmOffline')} ${sinceNow(device.lastUpdate)}`;
      break;
    default:
      text = t('xmInactive');
  }
  return (
    <Typography className={classes.stateText} style={{ color: stateColors[state] }}>
      {text}
    </Typography>
  );
};

const Row = ({ index, style, rows, onToggleGroup, onMenu }) => {
  const { classes, cx } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();
  const row = rows[index];
  const selectedId = useSelector((state) => state.devices.selectedId);
  const position = useSelector((state) =>
    row.type === 'device' ? state.session.positions[row.device.id] : null,
  );

  if (row.type === 'group') {
    return (
      <div style={style} className={classes.groupRow} onClick={() => onToggleGroup(row.key)}>
        {row.collapsed ? <ArrowRightIcon /> : <ArrowDropDownIcon />}
        <Typography variant="body2" fontWeight={600}>
          {`${row.name} (${row.count})`}
        </Typography>
      </div>
    );
  }

  const { device } = row;
  const state = getDeviceState(device, position);
  const attributes = position?.attributes || {};

  return (
    <div
      style={style}
      className={cx(classes.deviceRow, selectedId === device.id && classes.selected)}
      onClick={() => dispatch(devicesActions.selectId(device.id))}
    >
      <span className={classes.dot} style={{ backgroundColor: stateColors[state] }} />
      <div className={classes.deviceText}>
        <Typography
          className={classes.deviceName}
          style={{ color: state === 'offline' ? stateColors.offline : undefined }}
        >
          {device.name}
        </Typography>
        <Typography className={classes.deviceSub}>{device.uniqueId}</Typography>
      </div>
      <div className={classes.icons}>
        {attributes.hasOwnProperty('alarm') && (
          <Tooltip title={t('eventAlarm')}>
            <ErrorIcon fontSize="small" color="error" />
          </Tooltip>
        )}
        {attributes.hasOwnProperty('ignition') && (
          <Tooltip title={`${t('xmAcc')} ${attributes.ignition ? t('xmAccOn') : t('xmAccOff')}`}>
            <KeyIcon
              fontSize="small"
              style={{ color: attributes.ignition ? stateColors.moving : stateColors.inactive }}
            />
          </Tooltip>
        )}
        {attributes.blocked && (
          <Tooltip title={t('xmEngineCut')}>
            <PowerSettingsNewIcon fontSize="small" color="error" />
          </Tooltip>
        )}
      </div>
      <DeviceStateText device={device} position={position} />
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onMenu(e.currentTarget, device.id);
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </div>
  );
};

const MonitorPanel = ({
  devices,
  keyword,
  setKeyword,
  filter,
  setFilter,
  filterSort,
  setFilterSort,
  filterMap,
  setFilterMap,
}) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const deviceReadonly = useDeviceReadonly();
  const readonly = useRestriction('readonly');
  const limitCommands = useRestriction('limitCommands');
  const disableReports = useRestriction('disableReports');

  const allDevices = useSelector((state) => state.devices.items);
  const customer = useSelector((state) => state.devices.customer);
  const groups = useSelector((state) => state.groups.items);

  const [collapsed, setCollapsed] = usePersistedState('xmCollapsedGroups', []);
  const [menu, setMenu] = useState(null);
  const [optionsAnchor, setOptionsAnchor] = useState(null);
  const [engine, setEngine] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [trackerSmsId, setTrackerSmsId] = useState(null);

  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow('api/devices', { signal });
      dispatch(devicesActions.refresh(await response.json()));
    },
    [dispatch],
  );

  const tab =
    Object.entries(tabStatuses).find(
      ([, statuses]) => statuses.join() === (filter.statuses || []).join(),
    )?.[0] || 'all';

  const counts = useMemo(() => {
    const customerIds = customer ? new Set(customer.deviceIds) : null;
    const lower = keyword.toLowerCase();
    const result = { all: 0, online: 0, offline: 0, inactive: 0 };
    Object.values(allDevices)
      .filter((d) => !customerIds || customerIds.has(d.id))
      .filter((d) =>
        [d.name, d.uniqueId, d.phone, d.model, d.contact].some(
          (s) => s && s.toLowerCase().includes(lower),
        ),
      )
      .forEach((d) => {
        result.all += 1;
        if (d.status === 'online') result.online += 1;
        else if (d.status === 'offline') result.offline += 1;
        else result.inactive += 1;
      });
    return result;
  }, [allDevices, customer, keyword]);

  const rows = useMemo(() => {
    const byGroup = new Map();
    devices.forEach((device) => {
      const key = device.groupId && groups[device.groupId] ? device.groupId : 0;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(device);
    });
    const keys = [...byGroup.keys()].sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return groups[a].name.localeCompare(groups[b].name);
    });
    const result = [];
    keys.forEach((key) => {
      const items = byGroup.get(key);
      const isCollapsed = collapsed.includes(key);
      result.push({
        type: 'group',
        key,
        name: key ? groups[key].name : t('xmUngrouped'),
        count: items.length,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        items.forEach((device) => result.push({ type: 'device', device }));
      }
    });
    return result;
  }, [devices, groups, collapsed, t]);

  const toggleGroup = (key) =>
    setCollapsed((previous) =>
      previous.includes(key) ? previous.filter((it) => it !== key) : [...previous, key],
    );

  const menuAction = (callback) => () => {
    const { deviceId } = menu;
    setMenu(null);
    callback(deviceId);
  };

  return (
    <div className={classes.root}>
      <div className={classes.searchRow}>
        <OutlinedInput
          size="small"
          fullWidth
          placeholder={t('xmSearchPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          endAdornment={
            <InputAdornment position="end">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          }
        />
        <Tooltip title={t('sharedAdd')}>
          <span>
            <IconButton
              color="primary"
              data-testid="xm-add-device"
              onClick={() => setAddOpen(true)}
              disabled={deviceReadonly}
            >
              <AddCircleOutlineIcon />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton onClick={(e) => setOptionsAnchor(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
      </div>
      <Tabs
        className={classes.tabs}
        value={tab}
        variant="fullWidth"
        onChange={(_, value) => setFilter({ ...filter, statuses: tabStatuses[value] })}
      >
        <Tab value="all" label={`${t('xmAll')}(${counts.all})`} />
        <Tab value="online" label={`${t('xmOnline')}(${counts.online})`} />
        <Tab value="offline" label={`${t('xmOffline')}(${counts.offline})`} />
        <Tab value="inactive" label={`${t('xmInactive')}(${counts.inactive})`} />
      </Tabs>
      <div className={classes.toolsRow}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={filterMap}
              onChange={(e) => setFilterMap(e.target.checked)}
            />
          }
          label={t('sharedFilterMap')}
        />
        <Typography variant="caption" color="textSecondary">
          {`${t('xmTotal')}: ${devices.length}`}
        </Typography>
      </div>
      <div className={classes.list}>
        {rows.length ? (
          <List
            rowComponent={Row}
            rowCount={rows.length}
            rowHeight={(index) => (rows[index].type === 'group' ? HEADER_ROW : DEVICE_ROW)}
            rowProps={{
              rows,
              onToggleGroup: toggleGroup,
              onMenu: (anchorEl, deviceId) => setMenu({ anchorEl, deviceId }),
            }}
            overscanCount={8}
          />
        ) : (
          <Typography className={classes.empty}>{t('xmNoDevices')}</Typography>
        )}
      </div>

      <Menu
        anchorEl={optionsAnchor}
        open={Boolean(optionsAnchor)}
        onClose={() => setOptionsAnchor(null)}
      >
        <MenuItem disabled>
          <Typography variant="caption">{t('sharedSortBy')}</Typography>
        </MenuItem>
        {[
          ['', t('xmDefaultSort')],
          ['name', t('sharedName')],
          ['lastUpdate', t('deviceLastUpdate')],
        ].map(([value, label]) => (
          <MenuItem
            key={value}
            selected={filterSort === value}
            onClick={() => {
              setFilterSort(value);
              setOptionsAnchor(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setCollapsed([]);
            setOptionsAnchor(null);
          }}
        >
          {t('xmExpandAll')}
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={menu?.anchorEl}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem onClick={menuAction((id) => navigate(`/replay?deviceId=${id}`))}>
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('xmPlayback')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={menuAction((id) => navigate(`/tracking/${id}`))}>
          <ListItemIcon>
            <NearMeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('xmTracking')}</ListItemText>
        </MenuItem>
        {!limitCommands && (
          <MenuItem onClick={menuAction((id) => navigate(`/settings/device/${id}/command`))}>
            <ListItemIcon>
              <TerminalIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('xmCommands')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={menuAction((id) => {
            dispatch(devicesActions.selectId(id));
          })}
        >
          <ListItemIcon>
            <ArticleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('xmDetails')}</ListItemText>
        </MenuItem>
        {!deviceReadonly && (
          <MenuItem onClick={menuAction((id) => navigate(`/settings/device/${id}`))}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('sharedEdit')}</ListItemText>
          </MenuItem>
        )}
        {!disableReports && (
          <MenuItem onClick={menuAction((id) => navigate(`/reports/combined?deviceId=${id}`))}>
            <ListItemIcon>
              <AssessmentIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('xmViewReport')}</ListItemText>
          </MenuItem>
        )}
        {!readonly && !limitCommands && (
          <MenuItem onClick={menuAction((id) => setTrackerSmsId(id))}>
            <ListItemIcon>
              <SmsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('xmTrackerSms')}</ListItemText>
          </MenuItem>
        )}
        {!readonly && !limitCommands && <Divider />}
        {!readonly && !limitCommands && (
          <MenuItem onClick={menuAction((id) => setEngine({ deviceId: id, action: 'engineStop' }))}>
            <ListItemIcon>
              <PowerSettingsNewIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText slotProps={{ primary: { color: 'error' } }}>
              {t('xmEngineCut')}
            </ListItemText>
          </MenuItem>
        )}
        {!readonly && !limitCommands && (
          <MenuItem
            onClick={menuAction((id) => setEngine({ deviceId: id, action: 'engineResume' }))}
          >
            <ListItemIcon>
              <PowerIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>{t('xmEngineRestore')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
      <Box>
        <QuickAddDeviceDialog open={addOpen} onClose={() => setAddOpen(false)} />
        <TrackerSmsDialog deviceId={trackerSmsId} onClose={() => setTrackerSmsId(null)} />
        <EngineControlDialog
          deviceId={engine?.deviceId}
          action={engine?.action}
          onClose={() => setEngine(null)}
        />
      </Box>
    </div>
  );
};

export default MonitorPanel;
