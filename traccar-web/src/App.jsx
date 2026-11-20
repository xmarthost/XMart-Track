import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useMediaQuery, useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import MobileBottomNav from './mobile/MobileBottomNav';
import SocketController from './SocketController';
import CachingController from './CachingController';
import { useCatch, useAsyncTask } from './reactHelper';
import { sessionActions } from './store';
import UpdateController from './UpdateController';
import MotionController from './main/MotionController';
import TermsDialog from './common/components/TermsDialog';
import Loader from './common/components/Loader';
import useFeatures from './common/util/useFeatures';
import fetchOrThrow from './common/util/fetchOrThrow';
import AppHeader from './common/components/xmart/AppHeader';
import NavRail from './common/components/xmart/NavRail';

const useStyles = makeStyles()(() => ({
  page: {
    flexGrow: 1,
    overflow: 'auto',
  },
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    overflow: 'auto',
    // makes position: fixed children (map sidebar, status card, page drawers)
    // relative to the content area instead of the whole window
    transform: 'translateZ(0)',
  },
  menu: {
    zIndex: 4,
    '@media print': {
      display: 'none',
    },
  },
}));

const App = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const features = useFeatures();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const newServer = useSelector((state) => state.session.server.newServer);
  const termsUrl = useSelector((state) => state.session.server.attributes.termsUrl);
  const user = useSelector((state) => state.session.user);

  const acceptTerms = useCatch(async () => {
    const response = await fetchOrThrow(`api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, attributes: { ...user.attributes, termsAccepted: true } }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  });

  useAsyncTask(
    async ({ signal }) => {
      if (!user) {
        const response = await fetch('api/session', { signal });
        if (response.ok) {
          dispatch(sessionActions.updateUser(await response.json()));
        } else {
          window.sessionStorage.setItem('postLogin', location.pathname + location.search);
          navigate(newServer ? '/register' : '/login', { replace: true });
        }
      }
      return null;
    },
    [user, dispatch, navigate, newServer, location.pathname, location.search],
  );

  if (user == null) {
    return <Loader />;
  }
  if (termsUrl && !user.attributes.termsAccepted) {
    return <TermsDialog open onCancel={() => navigate('/login')} onAccept={() => acceptTerms()} />;
  }
  return (
    <>
      <SocketController />
      <CachingController />
      <UpdateController />
      <MotionController />
      {desktop ? (
        <div className={classes.shell}>
          <AppHeader />
          <div className={classes.body}>
            <NavRail />
            <div className={classes.content}>
              <Outlet />
            </div>
          </div>
        </div>
      ) : (
        <div className={classes.page}>
          <Outlet />
        </div>
      )}
      {!desktop && !features.disableTabs && (
        <div className={classes.menu}>
          <MobileBottomNav />
        </div>
      )}
    </>
  );
};

export default App;
