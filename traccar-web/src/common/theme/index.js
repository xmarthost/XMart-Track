import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';

export default (server, darkMode, direction) =>
  useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily: 'Roboto,Segoe UI,Helvetica Neue,Arial,sans-serif',
          // XMart: slightly heavier text for readability on phones
          body1: { fontWeight: 500 },
          body2: { fontWeight: 500 },
          caption: { fontWeight: 500 },
          button: { fontWeight: 600 },
        },
        palette: palette(server, darkMode),
        direction,
        dimensions,
        components,
      }),
    [server, darkMode, direction],
  );
