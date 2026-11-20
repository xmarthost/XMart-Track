import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { sessionActions } from '../../store';
import { useTranslation } from '../../common/components/LocalizationProvider';

const INTERVAL = 10;

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'absolute',
    top: theme.spacing(1.5),
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(8px)',
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    animation: 'xm-pulse 1.6s ease-in-out infinite',
    '@keyframes xm-pulse': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.35 },
    },
  },
}));

// Live data arrives over the websocket; this also re-reads positions every 10 seconds
// (like other tracking platforms) so the map stays fresh if the connection stalls.
const LiveRefresh = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();
  const socket = useSelector((state) => state.session.socket);
  const [seconds, setSeconds] = useState(INTERVAL);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((value) => (value <= 1 ? INTERVAL : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (seconds !== INTERVAL) return undefined;
    const controller = new AbortController();
    fetch('api/positions', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((positions) => {
        if (positions) {
          dispatch(sessionActions.updatePositions(positions));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [seconds, dispatch]);

  return (
    <Paper elevation={2} className={classes.root}>
      <span
        className={classes.dot}
        style={{ backgroundColor: socket === false ? '#DC2626' : '#16A34A' }}
      />
      <Typography variant="caption" fontWeight={600}>
        {t('xmRefreshIn').replace('{seconds}', seconds)}
      </Typography>
    </Paper>
  );
};

export default LiveRefresh;
