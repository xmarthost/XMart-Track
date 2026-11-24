import { createSlice } from '@reduxjs/toolkit';

const { reducer, actions } = createSlice({
  name: 'session',
  initialState: {
    server: null,
    user: null,
    socket: null,
    includeLogs: false,
    logs: [],
    positions: {},
    history: {},
  },
  reducers: {
    updateServer(state, action) {
      state.server = action.payload;
    },
    updateUser(state, action) {
      state.user = action.payload;
    },
    updateSocket(state, action) {
      state.socket = action.payload;
    },
    enableLogs(state, action) {
      state.includeLogs = action.payload;
      if (!action.payload) {
        state.logs = [];
      }
    },
    updateLogs(state, action) {
      state.logs.push(...action.payload);
    },
    updatePositions(state, action) {
      const liveRoutes =
        state.user.attributes.mapLiveRoutes || state.server.attributes.mapLiveRoutes || 'all';
      const liveRoutesLimit =
        state.user.attributes['web.liveRouteLength'] ||
        state.server.attributes['web.liveRouteLength'] ||
        300;
      action.payload.forEach((position) => {
        state.positions[position.deviceId] = position;
        // only real GPS fixes while driving (no fix without satellites, no jump while parked)
        const trailPoint =
          position.valid !== false &&
          (position.attributes?.sat ?? 1) > 0 &&
          (position.speed > 2 || position.attributes?.motion === true);
        if (liveRoutes !== 'none') {
          if (!trailPoint) return;
          const route = state.history[position.deviceId] || [];
          const last = route.at(-1);
          if (!last || last[0] !== position.longitude || last[1] !== position.latitude) {
            state.history[position.deviceId] = [
              ...route.slice(1 - liveRoutesLimit),
              [position.longitude, position.latitude],
            ];
          }
        } else {
          state.history = {};
        }
      });
    },
  },
});

export { actions as sessionActions };
export { reducer as sessionReducer };
