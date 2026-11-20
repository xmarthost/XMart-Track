import { grey } from '@mui/material/colors';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

// XMart brand colors
export const brand = {
  teal: '#007080',
  tealLight: '#2090A0',
  tealDark: '#0A4A55',
  charcoal: '#1E293B',
  green: '#16A34A',
  amber: '#F59E0B',
  red: '#DC2626',
  blue: '#2563EB',
};

export default (server, darkMode) => {
  const primary = validatedColor(server?.attributes?.colorPrimary) || brand.teal;
  const secondary = validatedColor(server?.attributes?.colorSecondary) || brand.green;
  return {
    mode: darkMode ? 'dark' : 'light',
    background: {
      default: darkMode ? grey[900] : '#F4F8FD',
    },
    ...(darkMode ? {} : { text: { primary: '#0F172A', secondary: '#475569' } }),
    primary: {
      main: darkMode ? brand.tealLight : primary,
    },
    secondary: {
      main: secondary,
    },
    nav: {
      main: darkMode ? '#0B2A30' : validatedColor(server?.attributes?.colorNav) || brand.tealDark,
      contrastText: '#FFFFFF',
    },
    neutral: {
      main: grey[500],
    },
    geometry: {
      main: '#3bb2d0',
    },
    alwaysDark: {
      main: grey[900],
    },
  };
};
