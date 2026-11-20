import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import * as maplibregl from 'maplibre-gl';
import { ButtonBase, ListItemIcon, ListItemText, Menu, MenuItem, Paper } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import FenceIcon from '@mui/icons-material/Fence';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import StreetviewIcon from '@mui/icons-material/Man';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import TuneIcon from '@mui/icons-material/Tune';
import CheckIcon from '@mui/icons-material/Check';
import { devicesActions, sessionActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import { useAttributePreference } from '../common/util/preferences';
import { useTranslation } from '../common/components/LocalizationProvider';
import useMapStyles, { defaultActiveMapStyles } from '../map/core/useMapStyles';
import { map } from '../map/core/MapView';
import { toMapCoordinates, xmZoom } from '../map/core/mapUtil';

const SIZE = 44;
const satelliteIds = ['googleHybrid', 'googleSatellite', 'esriSatellite', 'mapTilerHybrid'];

const useStyles = makeStyles()((theme) => ({
  column: {
    position: 'absolute',
    top: theme.spacing(2),
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.16)',
    '& svg': { fontSize: 24 },
  },
  active: {
    color: theme.palette.primary.main,
  },
  pair: {
    width: SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.16)',
    '& .MuiButtonBase-root': {
      height: 40,
      color: '#1F2937',
    },
    '& .Mui-disabled': {
      color: 'rgba(31, 41, 55, 0.3)',
    },
  },
  divider: {
    height: 1,
    margin: '0 8px',
    backgroundColor: theme.palette.divider,
  },
}));

// Fixed map buttons for phones, laid out like common tracking apps:
// left = refresh, geofences, map type, previous/next vehicle;
// right = more, satellite, alerts, street view, center vehicle.
const MobileMapControls = ({ devices, positions }) => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const mapStyles = useMapStyles();
  const activeMapStyles = useAttributePreference('activeMapStyles', defaultActiveMapStyles);
  const [selectedStyle, setSelectedStyle] = usePersistedState('selectedMapStyle', 'googleRoad');
  const [roadStyle, setRoadStyle] = usePersistedState('xmRoadStyle', 'googleRoad');
  const [layersAnchor, setLayersAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);

  const selectedId = useSelector((state) => state.devices.selectedId);
  const allPositions = useSelector((state) => state.session.positions);
  const selectedPosition = selectedId ? allPositions[selectedId] : null;

  const styles = mapStyles.filter((s) => s.available && activeMapStyles.includes(s.id));
  const satellite = satelliteIds.includes(selectedStyle);

  const vehicleIds = useMemo(
    () => devices.filter((device) => allPositions[device.id]).map((device) => device.id),
    [devices, allPositions],
  );
  const canSwitch = vehicleIds.length > 1;

  const switchVehicle = (step) => {
    if (!canSwitch) return;
    const index = vehicleIds.indexOf(selectedId);
    const next = vehicleIds[(index + step + vehicleIds.length) % vehicleIds.length];
    dispatch(devicesActions.selectId(next));
  };

  const refresh = async () => {
    try {
      const [positionsResponse, devicesResponse] = await Promise.all([
        fetch('api/positions'),
        fetch('api/devices'),
      ]);
      if (positionsResponse.ok) {
        dispatch(sessionActions.updatePositions(await positionsResponse.json()));
      }
      if (devicesResponse.ok) {
        dispatch(devicesActions.update(await devicesResponse.json()));
      }
    } catch {
      // offline; the live connection will catch up
    }
  };

  const toggleSatellite = () => {
    if (satellite) {
      setSelectedStyle(roadStyle);
    } else {
      setRoadStyle(selectedStyle);
      setSelectedStyle(satelliteIds.find((id) => activeMapStyles.includes(id)) || 'esriSatellite');
    }
  };

  const center = () => {
    if (selectedPosition) {
      map.easeTo({
        center: toMapCoordinates(selectedPosition.longitude, selectedPosition.latitude),
        zoom: Math.max(map.getZoom(), xmZoom()),
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((location) => {
        map.easeTo({
          center: toMapCoordinates(location.coords.longitude, location.coords.latitude),
          zoom: xmZoom(),
        });
      });
    }
  };

  const fitAll = () => {
    setMoreAnchor(null);
    const coordinates = positions.map((p) => toMapCoordinates(p.longitude, p.latitude));
    if (coordinates.length === 1) {
      map.easeTo({ center: coordinates[0], zoom: xmZoom() });
    } else if (coordinates.length > 1) {
      const bounds = coordinates.reduce(
        (result, item) => result.extend(item),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: xmZoom() });
    }
  };

  const streetView = () => {
    if (selectedPosition) {
      window.open(
        `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedPosition.latitude},${selectedPosition.longitude}&heading=${selectedPosition.course || 0}`,
        '_blank',
      );
    }
  };

  const button = (key, icon, onClick, active, disabled) => (
    <Paper key={key} elevation={0} className={classes.button} component="div">
      <ButtonBase
        className={cx(classes.button, active && classes.active)}
        onClick={onClick}
        disabled={disabled}
        sx={{ boxShadow: 'none !important' }}
      >
        {icon}
      </ButtonBase>
    </Paper>
  );

  return (
    <>
      <div className={classes.column} style={{ left: 16 }}>
        {button('refresh', <AutorenewIcon />, refresh)}
        {button('fence', <FenceIcon />, () => navigate('/geofences'))}
        {button('layers', <MapOutlinedIcon />, (e) => setLayersAnchor(e.currentTarget))}
        <Paper elevation={0} className={classes.pair} style={{ opacity: canSwitch ? 1 : 0.55 }}>
          <ButtonBase onClick={() => switchVehicle(-1)} disabled={!canSwitch}>
            <KeyboardArrowUpIcon />
          </ButtonBase>
          <div className={classes.divider} />
          <ButtonBase onClick={() => switchVehicle(1)} disabled={!canSwitch}>
            <KeyboardArrowDownIcon />
          </ButtonBase>
        </Paper>
      </div>
      <div className={classes.column} style={{ right: 16 }}>
        {button('more', <MoreHorizIcon />, (e) => setMoreAnchor(e.currentTarget))}
        {button('satellite', <SatelliteAltIcon />, toggleSatellite, satellite)}
        {button('alerts', <ChatBubbleOutlineIcon />, () => navigate('/events'))}
        {button('street', <StreetviewIcon />, streetView, false, !selectedPosition)}
        {button('center', <GpsFixedIcon />, center)}
      </div>

      <Menu
        anchorEl={layersAnchor}
        open={Boolean(layersAnchor)}
        onClose={() => setLayersAnchor(null)}
      >
        {styles.map((style) => (
          <MenuItem
            key={style.id}
            selected={style.id === selectedStyle}
            onClick={() => {
              setSelectedStyle(style.id);
              setLayersAnchor(null);
            }}
          >
            <ListItemIcon>
              {style.id === selectedStyle && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{style.title}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={fitAll}>
          <ListItemIcon>
            <ZoomOutMapIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('xmShowAll')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMoreAnchor(null);
            navigate('/settings/preferences');
          }}
        >
          <ListItemIcon>
            <TuneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('sharedPreferences')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default MobileMapControls;
