import { useState } from 'react';
import dayjs from 'dayjs';
import { useAsyncTask } from '../../reactHelper';

// Loads values that are not part of the live position: when ACC last changed
// and the distance travelled today. Reloaded when the ignition state changes.
const useDeviceExtras = (deviceId, ignition) => {
  const [extras, setExtras] = useState({});

  useAsyncTask(
    async ({ signal }) => {
      setExtras({});
      if (!deviceId) return;
      const headers = { Accept: 'application/json' };
      const now = dayjs();
      const eventsQuery = new URLSearchParams({
        deviceId,
        from: now.subtract(7, 'day').toISOString(),
        to: now.toISOString(),
      });
      eventsQuery.append('type', 'ignitionOn');
      eventsQuery.append('type', 'ignitionOff');
      const summaryQuery = new URLSearchParams({
        deviceId,
        from: now.startOf('day').toISOString(),
        to: now.toISOString(),
      });
      const [eventsResponse, summaryResponse] = await Promise.all([
        fetch(`api/reports/events?${eventsQuery.toString()}`, { headers, signal }),
        fetch(`api/reports/summary?${summaryQuery.toString()}`, { headers, signal }),
      ]);
      const events = eventsResponse.ok ? await eventsResponse.json() : [];
      const summary = summaryResponse.ok ? await summaryResponse.json() : [];
      const lastAcc = events.reduce(
        (latest, event) =>
          !latest || dayjs(event.eventTime).isAfter(latest.eventTime) ? event : latest,
        null,
      );
      setExtras({
        accSince: lastAcc?.eventTime,
        todayDistance: summary[0]?.distance,
      });
    },
    // ignition is a reload trigger
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [deviceId, ignition],
  );

  return extras;
};

export default useDeviceExtras;
