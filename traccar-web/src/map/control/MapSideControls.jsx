import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import * as maplibregl from 'maplibre-gl';
import { Paper, IconButton, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import MapIcon from '@mui/icons-material/Map';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import MyLocationIcon from '@mui/icons-material/GpsFixed';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import usePersistedState from '../../common/util/usePersistedState';
import { useAttributePreference } from '../../common/util/preferences';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { defaultActiveMapStyles } from '../core/useMapStyles';
import { map } from '../core/MapView';
import { toMapCoordinates } from '../core/mapUtil';

const satelliteIds = ['googleHybrid', 'esriSatellite', 'googleSatellite', 'mapTilerHybrid'];

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'absolute',
    top: theme.spacing(1.5),
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    pointerEvents: 'none',
  },
  button: {
    pointerEvents: 'auto',
    borderRadius: 10,
    '& .MuiIconButton-root': {
      width: 44,
      height: 44,
      color: theme.palette.text.primary,
    },
  },
  active: {
    '& .MuiIconButton-root': {
      color: theme.palette.primary.main,
    },
  },
}));

// Fixed map buttons on the left side (WanWay style): satellite toggle, show all
// vehicles, center the selected vehicle and open geofences.
const MapSideControls = ({ left = 12, positions }) => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const activeMapStyles = useAttributePreference('activeMapStyles', defaultActiveMapStyles);
  const [selectedStyle, setSelectedStyle] = usePersistedState('selectedMapStyle', 'openFreeMap');
  const [roadStyle, setRoadStyle] = usePersistedState('xmRoadStyle', 'openFreeMap');
  const selectedId = useSelector((state) => state.devices.selectedId);
  const selectedPosition = useSelector((state) =>
    selectedId ? state.session.positions[selectedId] : null,
  );

  const satellite = satelliteIds.includes(selectedStyle);

  const toggleSatellite = () => {
    if (satellite) {
      setSelectedStyle(roadStyle);
    } else {
      setRoadStyle(selectedStyle);
      setSelectedStyle(satelliteIds.find((id) => activeMapStyles.includes(id)) || 'esriSatellite');
    }
  };

  const fitAll = () => {
    const coordinates = (positions || []).map((p) => toMapCoordinates(p.longitude, p.latitude));
    if (coordinates.length === 1) {
      map.easeTo({ center: coordinates[0], zoom: 16 });
    } else if (coordinates.length > 1) {
      const bounds = coordinates.reduce(
        (result, item) => result.extend(item),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  };

  const centerSelected = () => {
    if (selectedPosition) {
      map.easeTo({
        center: toMapCoordinates(selectedPosition.longitude, selectedPosition.latitude),
        zoom: Math.max(map.getZoom(), 16),
      });
    }
  };

  const buttons = [
    {
      key: 'satellite',
      title: satellite ? t('mapTitle') : 'Satellite',
      icon: satellite ? <MapIcon /> : <SatelliteAltIcon />,
      onClick: toggleSatellite,
      active: satellite,
    },
    { key: 'all', title: t('xmShowAll'), icon: <ZoomOutMapIcon />, onClick: fitAll },
    {
      key: 'center',
      title: t('xmCenterVehicle'),
      icon: <MyLocationIcon />,
      onClick: centerSelected,
      disabled: !selectedPosition,
    },
    {
      key: 'geofences',
      title: t('sharedGeofences'),
      icon: <HexagonOutlinedIcon />,
      onClick: () => navigate('/geofences'),
    },
  ];

  return (
    <div className={classes.root} style={{ left }}>
      {buttons.map((button) => (
        <Paper
          key={button.key}
          elevation={3}
          className={cx(classes.button, button.active && classes.active)}
        >
          <Tooltip title={button.title} placement="right">
            <span>
              <IconButton onClick={button.onClick} disabled={button.disabled}>
                {button.icon}
              </IconButton>
            </span>
          </Tooltip>
        </Paper>
      ))}
    </div>
  );
};

export default MapSideControls;
