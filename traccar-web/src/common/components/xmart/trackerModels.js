// Tracker models offered in the quick "Add device" dialog. Each model maps to the Traccar
// protocol/port it reports on and the SMS commands that point it to this server.
// {host}, {port} and {apn} are replaced when shown to the user. Admins can override the
// server command with the server attribute "xm.serverCommand".
export const trackerModels = [
  {
    id: 'wanway-g19s',
    name: 'WanWay G19S (Wired)',
    protocol: 'gt06',
    port: 5023,
    serverCommand: 'SERVER,1,{host},{port},0#',
    apnCommand: 'APN,{apn}#',
    checkCommand: 'PARAM#',
    resetCommand: 'RESET#',
  },
  {
    id: 'concox-gt06',
    name: 'Concox / GT06 compatible',
    protocol: 'gt06',
    port: 5023,
    serverCommand: 'SERVER,1,{host},{port},0#',
    apnCommand: 'APN,{apn}#',
    checkCommand: 'PARAM#',
    resetCommand: 'RESET#',
  },
  {
    id: 'jt808',
    name: 'JT808 compatible',
    protocol: 'jt808',
    port: 5015,
    serverCommand: 'SERVER,1,{host},{port},0#',
    apnCommand: 'APN,{apn}#',
    checkCommand: 'PARAM#',
    resetCommand: 'RESET#',
  },
];

// Common Pakistani mobile operator APNs.
export const apnPresets = [
  { id: 'jazz', name: 'Jazz', apn: 'jazzconnect.mobilinkworld.com' },
  { id: 'zong', name: 'Zong', apn: 'zonginternet' },
  { id: 'telenor', name: 'Telenor', apn: 'internet' },
  { id: 'ufone', name: 'Ufone', apn: 'ufone.internet' },
];

export const fillCommand = (template, values) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value ?? ''),
    template || '',
  );
