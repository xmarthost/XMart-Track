// Geofence schedules are Traccar calendars (iCalendar). Traccar checks a geofence only while its
// calendar is active, so a schedule makes the geofence work daily, on chosen days or one time.
// Times are written in UTC (Z) so the server's time zone does not matter.

export const DAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];
const JS_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const pad = (n) => String(n).padStart(2, '0');
const utc = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// "2026-11-24" + "22:30" -> Date (local time), or null
export function parseLocal(date, time = '00:00') {
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((date || '').trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim());
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0);
  return Number.isNaN(d.getTime()) || Number(tm[1]) > 23 ? null : d;
}

export const defaultSchedule = () => {
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 3600 * 1000);
  return {
    mode: 'always', // always | once | daily | days
    startDate: localDate(now),
    startTime: localTime(now),
    endDate: localDate(later),
    endTime: localTime(later),
    from: '22:00',
    to: '06:00',
    days: ['MO', 'TU', 'WE', 'TH', 'FR'],
    ends: '', // daily / days: last day (YYYY-MM-DD) or '' = never
  };
};

// Returns { ical } or { error }
export function buildCalendar(schedule, name) {
  const s = schedule;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//XMart Track//Geofence schedule//EN', 'BEGIN:VEVENT'];
  lines.push(`UID:xmart-${Date.now()}@xmarttrack`, `DTSTAMP:${utc(new Date())}`);
  if (s.mode === 'once') {
    const start = parseLocal(s.startDate, s.startTime);
    const end = parseLocal(s.endDate, s.endTime);
    if (!start || !end) return { error: 'Enter start and end as YYYY-MM-DD and HH:MM.' };
    if (end <= start) return { error: 'The end must be after the start.' };
    lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`);
  } else if (s.mode === 'daily' || s.mode === 'days') {
    if (s.mode === 'days' && !s.days?.length) return { error: 'Choose at least one day.' };
    // first day: today, or the next chosen weekday
    const today = new Date();
    let first = parseLocal(localDate(today), s.from);
    if (!first) return { error: 'Enter times as HH:MM (24 hours), e.g. 22:00.' };
    if (s.mode === 'days') {
      for (let i = 0; i < 7 && !s.days.includes(JS_DAY[first.getDay()]); i += 1) {
        first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1, first.getHours(), first.getMinutes());
      }
    }
    const endSameDay = parseLocal(localDate(first), s.to);
    if (!endSameDay) return { error: 'Enter times as HH:MM (24 hours), e.g. 06:00.' };
    const end = endSameDay > first ? endSameDay : new Date(endSameDay.getTime() + 24 * 3600 * 1000);
    lines.push(`DTSTART:${utc(first)}`, `DTEND:${utc(end)}`);
    let rule;
    if (s.mode === 'daily') {
      rule = 'FREQ=DAILY';
    } else {
      // weekdays are counted in UTC: shift them when the local start falls on another UTC day
      const shift = (first.getUTCDay() - first.getDay() + 7) % 7; // 0, 1 or 6
      const days = s.days.map((d) => JS_DAY[(JS_DAY.indexOf(d) + shift) % 7]);
      rule = `FREQ=WEEKLY;BYDAY=${days.join(',')}`;
    }
    if (s.ends) {
      const last = parseLocal(s.ends, '23:59');
      if (!last) return { error: 'Enter the last day as YYYY-MM-DD.' };
      if (last < first) return { error: 'The last day is before the first day.' };
      rule += `;UNTIL=${utc(last)}`;
    }
    lines.push(`RRULE:${rule}`);
  } else {
    return { ical: null };
  }
  lines.push(`SUMMARY:${(name || 'Geofence').replace(/[\r\n,;]/g, ' ')}`, 'END:VEVENT', 'END:VCALENDAR', '');
  return { ical: lines.join('\r\n') };
}

const dayNames = (days) =>
  days?.length === 7 ? 'every day' : DAYS.filter((d) => days?.includes(d.value)).map((d) => d.label).join(', ');

export function describeSchedule(s) {
  if (!s || s.mode === 'always') return 'Always on';
  if (s.mode === 'once') return `One time: ${s.startDate} ${s.startTime} → ${s.endDate} ${s.endTime}`;
  const window = `${s.from}–${s.to}`;
  const until = s.ends ? ` until ${s.ends}` : '';
  return s.mode === 'daily' ? `Daily ${window}${until}` : `${dayNames(s.days)} ${window}${until}`;
}

export function isExpired(s, now = new Date()) {
  if (!s || s.mode === 'always') return false;
  if (s.mode === 'once') {
    const end = parseLocal(s.endDate, s.endTime);
    return Boolean(end && end < now);
  }
  const last = s.ends ? parseLocal(s.ends, '23:59') : null;
  return Boolean(last && last < now);
}

// base64 of an ASCII string (calendar data is sent as bytes)
export const toBase64 = (text) => globalThis.btoa(text);
