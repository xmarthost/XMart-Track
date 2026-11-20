import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { Paper } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useDispatch, useSelector } from 'react-redux';
import DeviceList from './DeviceList';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MonitorPanel from './xmart/MonitorPanel';
import StatusCard from '../common/components/StatusCard';
import { devicesActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import EventsDrawer from './EventsDrawer';
import useFilter from './useFilter';
import MainToolbar from './MainToolbar';
import { useAttributePreference } from '../common/util/preferences';
import useFeatures from '../common/util/useFeatures';

const MainMap = lazy(() => import('./MainMap'));

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
  },
  sidebar: {
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('md')]: {
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100%',
      width: theme.dimensions.drawerWidthDesktop,
      zIndex: 3,
      boxShadow: '2px 0 8px rgba(15, 23, 42, 0.08)',
      transition: theme.transitions.create('transform'),
    },
    [theme.breakpoints.down('md')]: {
      height: '100%',
      width: '100%',
    },
  },
  header: {
    pointerEvents: 'auto',
    zIndex: 6,
  },
  footer: {
    pointerEvents: 'auto',
    zIndex: 5,
  },
  middle: {
    flex: 1,
    display: 'grid',
    minHeight: 0,
  },
  contentMap: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
  },
  panelToggle: {
    pointerEvents: 'auto',
    position: 'absolute',
    top: '50%',
    right: -20,
    width: 20,
    height: 56,
    marginTop: -28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backgroundColor: theme.palette.background.paper,
    borderRadius: '0 6px 6px 0',
    boxShadow: '2px 0 6px rgba(15, 23, 42, 0.15)',
    color: theme.palette.text.secondary,
  },
  contentList: {
    pointerEvents: 'auto',
    gridArea: '1 / 1',
    zIndex: 4,
    display: 'flex',
    minHeight: 0,
  },
}));

const MainPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const theme = useTheme();

  const features = useFeatures();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const mapOnSelect = useAttributePreference('mapOnSelect', true);

  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const selectedPosition = filteredPositions.find(
    (position) => selectedDeviceId && position.deviceId === selectedDeviceId,
  );

  const [filteredDevices, setFilteredDevices] = useState([]);

  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = usePersistedState('deviceFilter', {
    statuses: [],
    groups: [],
    geofences: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);

  const [devicesOpen, setDevicesOpen] = useState(desktop);
  const [eventsOpen, setEventsOpen] = useState(false);

  const onEventsClick = useCallback(() => setEventsOpen(true), [setEventsOpen]);

  useEffect(() => {
    if (!desktop && mapOnSelect && selectedDeviceId) {
      setDevicesOpen(false);
    }
  }, [desktop, mapOnSelect, selectedDeviceId]);

  useFilter(
    keyword,
    filter,
    filterSort,
    filterMap && !features.disableDeviceList,
    positions,
    setFilteredDevices,
    setFilteredPositions,
  );

  return (
    <div className={classes.root}>
      {desktop && (
        <Suspense fallback={null}>
          <MainMap
            filteredPositions={filteredPositions}
            selectedPosition={selectedPosition}
            onEventsClick={onEventsClick}
          />
        </Suspense>
      )}
      {desktop ? (
        <div
          className={classes.sidebar}
          style={devicesOpen ? undefined : { transform: 'translateX(-100%)' }}
        >
          {!features.disableDeviceList && (
            <Paper square elevation={0} className={classes.contentList} style={{ flex: 1 }}>
              <MonitorPanel
                devices={filteredDevices}
                keyword={keyword}
                setKeyword={setKeyword}
                filter={filter}
                setFilter={setFilter}
                filterSort={filterSort}
                setFilterSort={setFilterSort}
                filterMap={filterMap}
                setFilterMap={setFilterMap}
              />
            </Paper>
          )}
          <div className={classes.panelToggle} onClick={() => setDevicesOpen(!devicesOpen)}>
            {devicesOpen ? (
              <ChevronLeftIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </div>
        </div>
      ) : (
        <div className={classes.sidebar}>
          {!features.disableDeviceList && (
            <Paper square elevation={3} className={classes.header}>
              <MainToolbar
                filteredDevices={filteredDevices}
                devicesOpen={devicesOpen}
                setDevicesOpen={setDevicesOpen}
                keyword={keyword}
                setKeyword={setKeyword}
                filter={filter}
                setFilter={setFilter}
                filterSort={filterSort}
                setFilterSort={setFilterSort}
                filterMap={filterMap}
                setFilterMap={setFilterMap}
              />
            </Paper>
          )}
          <div className={classes.middle}>
            <div className={classes.contentMap}>
              <Suspense fallback={null}>
                <MainMap
                  filteredPositions={filteredPositions}
                  selectedPosition={selectedPosition}
                  onEventsClick={onEventsClick}
                />
              </Suspense>
            </div>
            {!features.disableDeviceList && (
              <Paper
                square
                className={classes.contentList}
                style={devicesOpen ? {} : { visibility: 'hidden' }}
              >
                <DeviceList devices={filteredDevices} />
              </Paper>
            )}
          </div>
        </div>
      )}
      <EventsDrawer open={eventsOpen} onClose={() => setEventsOpen(false)} />
      {selectedDeviceId && !features.disableStatusCard && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={selectedPosition}
          onClose={() => dispatch(devicesActions.selectId(null))}
          desktopPadding={
            features.disableDeviceList || !devicesOpen ? '0px' : theme.dimensions.drawerWidthDesktop
          }
        />
      )}
    </div>
  );
};

export default MainPage;
