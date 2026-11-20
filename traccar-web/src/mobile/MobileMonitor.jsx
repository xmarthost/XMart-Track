import { lazy, Suspense, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Tab, Tabs, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { devicesActions } from '../store';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useSearchParams } from 'react-router-dom';
import MonitorPanel from '../main/xmart/MonitorPanel';
import MobileDeviceSheet from './MobileDeviceSheet';
import MapSideControls from '../map/control/MapSideControls';
import xmartIcon from '../resources/images/xmart-icon.png';

const MainMap = lazy(() => import('../main/MainMap'));

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    zIndex: 7,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 2, 0),
    paddingTop: `calc(${theme.spacing(1.25)} + env(safe-area-inset-top))`,
  },
  icon: {
    width: 26,
    height: 26,
    position: 'absolute',
    left: theme.spacing(2),
  },
  title: {
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  tabs: {
    minHeight: 42,
    '& .MuiTab-root': {
      minHeight: 42,
      fontSize: '1rem',
      textTransform: 'none',
    },
  },
  content: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    inset: 0,
  },
}));

const MobileMonitor = ({ panelProps, filteredPositions, selectedPosition, onEventsClick }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'map' ? 'map' : 'list';
  const setView = useCallback(
    (value) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('view', value);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );
  const selectedId = useSelector((state) => state.devices.selectedId);
  const user = useSelector((state) => state.session.user);
  const customer = useSelector((state) => state.devices.customer);

  return (
    <div className={classes.root}>
      <Paper square elevation={1} className={classes.header}>
        <div className={classes.titleRow}>
          <img className={classes.icon} src={xmartIcon} alt="" />
          <Typography className={classes.title}>{customer?.name || user.name}</Typography>
        </div>
        <Tabs
          className={classes.tabs}
          value={view}
          variant="fullWidth"
          onChange={(_, value) => setView(value)}
        >
          <Tab value="list" label={t('xmList')} />
          <Tab value="map" label={t('mapTitle')} />
        </Tabs>
      </Paper>
      <div className={classes.content}>
        <div
          className={classes.layer}
          style={{ visibility: view === 'map' ? 'visible' : 'hidden' }}
        >
          <Suspense fallback={null}>
            <MainMap
              filteredPositions={filteredPositions}
              selectedPosition={selectedPosition}
              onEventsClick={onEventsClick}
            />
          </Suspense>
          <MapSideControls positions={filteredPositions} />
          {selectedId && (
            <MobileDeviceSheet
              deviceId={selectedId}
              onClose={() => dispatch(devicesActions.selectId(null))}
            />
          )}
        </div>
        {view === 'list' && (
          <div className={classes.layer}>
            <MonitorPanel {...panelProps} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileMonitor;
