// In-app log: keeps the last entries in memory so problems on a phone can be seen and shared
// from Me → Diagnostics without a computer or adb.
const MAX = 400;
const entries = [];
const listeners = new Set();
let snapshot = [];
let scheduled = false;
// listeners run on the next tick so logging during a render never updates other components mid-render
const notify = () => {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    snapshot = entries.slice();
    listeners.forEach((listener) => listener());
  }, 0);
};
let installed = false;

const stringify = (value) => {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export function log(level, tag, ...parts) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date(),
    level,
    tag,
    message: parts.map(stringify).join(' '),
  };
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
  notify();
}

export const logInfo = (tag, ...parts) => log('info', tag, ...parts);
export const logWarn = (tag, ...parts) => log('warn', tag, ...parts);
export const logError = (tag, ...parts) => log('error', tag, ...parts);

export const getLogs = () => snapshot;
export const clearLogs = () => {
  entries.length = 0;
  notify();
};
export const subscribeLogs = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const pad = (n, size = 2) => String(n).padStart(size, '0');
export const formatLogTime = (date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

export const logsAsText = () =>
  entries
    .slice()
    .reverse()
    .map((e) => `${formatLogTime(e.time)} ${e.level.toUpperCase()} [${e.tag}] ${e.message}`)
    .join('\n');

// Mirror console warnings/errors and uncaught JS errors into the log.
export function installLogCapture() {
  if (installed) return;
  installed = true;
  ['warn', 'error'].forEach((level) => {
    const original = console[level];
    console[level] = (...args) => {
      log(level, 'console', ...args);
      original.apply(console, args);
    };
  });
  const handler = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    log('error', isFatal ? 'fatal' : 'js', error?.stack || stringify(error));
    handler?.(error, isFatal);
  });
  logInfo('app', 'started');
}
