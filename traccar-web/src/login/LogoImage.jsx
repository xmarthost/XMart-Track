import { useTheme, useMediaQuery, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import xmartIcon from '../resources/images/xmart-icon.png';

const useStyles = makeStyles()((theme) => ({
  image: {
    alignSelf: 'center',
    maxWidth: '240px',
    maxHeight: '120px',
    width: 'auto',
    height: 'auto',
    margin: theme.spacing(2),
  },
  brand: {
    alignSelf: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    margin: theme.spacing(2),
  },
  icon: {
    width: 64,
    height: 64,
  },
  plate: {
    background: '#FFFFFF',
    borderRadius: '50%',
    padding: theme.spacing(1),
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
  },
  title: {
    fontWeight: 800,
    fontSize: '2rem',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontSize: '0.8rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    opacity: 0.8,
    marginTop: theme.spacing(0.5),
  },
}));

const LogoImage = ({ onDark }) => {
  const theme = useTheme();
  const { classes, cx } = useStyles();

  const expanded = !useMediaQuery(theme.breakpoints.down('lg'));

  const logo = useSelector((state) => state.session.server.attributes?.logo);
  const logoInverted = useSelector((state) => state.session.server.attributes?.logoInverted);
  const title = useSelector((state) => state.session.server.attributes?.title);

  if (logo) {
    if (expanded && logoInverted) {
      return <img className={classes.image} src={logoInverted} alt="" />;
    }
    return <img className={classes.image} src={logo} alt="" />;
  }
  const textColor = onDark ? '#FFFFFF' : theme.palette.text.primary;
  return (
    <div className={classes.brand}>
      <img className={cx(classes.icon, onDark && classes.plate)} src={xmartIcon} alt="" />
      <div>
        <Typography className={classes.title} style={{ color: textColor }}>
          {title || (
            <>
              XMart{' '}
              <span style={{ color: onDark ? '#7DD3DC' : theme.palette.primary.main }}>Track</span>
            </>
          )}
        </Typography>
        <Typography className={classes.tagline} style={{ color: textColor }}>
          GPS Tracking Platform
        </Typography>
      </div>
    </div>
  );
};

export default LogoImage;
