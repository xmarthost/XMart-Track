#!/usr/bin/env bash
# XMart Track server diagnostics: one A-to-Z report of the server, ports, services, database,
# tracker traffic and errors. Secrets (passwords, keys, tokens) are masked.
# Usage: curl -fsSL https://raw.githubusercontent.com/xmarthost/XMart-Track/xmart-web-ui/scripts/diagnose.sh | sudo bash
set -u

APP_DIR="${APP_DIR:-/opt/xmart-track}"
CONF="$APP_DIR/conf/traccar.xml"
LOG="$APP_DIR/logs/tracker-server.log"
OUT="/root/xmart-diagnose-$(date +%Y%m%d-%H%M%S).txt"
DB="xmarttrack"

exec > >(tee "$OUT") 2>&1

section() { printf '\n==================== %s ====================\n' "$*"; }
ok() { printf '  [OK]   %s\n' "$*"; }
bad() { printf '  [FAIL] %s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
sql() { mysql -u root "$DB" -N -B -e "$1" 2>&1; }
conf() { python3 - "$CONF" "$1" <<'PY' 2>/dev/null
import re, sys
text = open(sys.argv[1], encoding='utf-8').read()
m = re.search(r"<entry key=['\"]%s['\"]>(.*?)</entry>" % re.escape(sys.argv[2]), text, re.S)
print(m.group(1).strip() if m else '')
PY
}

section "1. SYSTEM"
info "Report time : $(date '+%Y-%m-%d %H:%M:%S %Z')"
info "Hostname    : $(hostname)"
info "OS          : $(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"
info "Uptime      : $(uptime -p 2>/dev/null)"
info "Load        : $(cut -d' ' -f1-3 /proc/loadavg)"
info "Timezone    : $(timedatectl show -p Timezone --value 2>/dev/null)  NTP synced: $(timedatectl show -p NTPSynchronized --value 2>/dev/null)"
free -h | sed 's/^/  /'
df -h / "$APP_DIR" 2>/dev/null | sed 's/^/  /'
info "Java        : $(java -version 2>&1 | head -1)"
info "Node        : $(node -v 2>/dev/null || echo 'not installed')"

section "2. DEPLOYED VERSION"
if [ -d "$APP_DIR/source/.git" ]; then
  git -C "$APP_DIR/source" log --oneline -5 2>&1 | sed 's/^/  /'
  info "Branch: $(git -C "$APP_DIR/source" rev-parse --abbrev-ref HEAD 2>/dev/null)"
else
  bad "no source checkout at $APP_DIR/source"
fi
ls -la "$APP_DIR"/tracker-server.jar 2>/dev/null | sed 's/^/  /'

section "3. SERVICES"
for s in xmart-track nginx mariadb; do
  state=$(systemctl is-active "$s" 2>/dev/null)
  if [ "$state" = active ]; then ok "$s: active (since $(systemctl show -p ActiveEnterTimestamp --value "$s"))"; else bad "$s: $state"; fi
done
info "xmart-track restarts: $(systemctl show -p NRestarts --value xmart-track 2>/dev/null)"
info "Last service messages:"
journalctl -u xmart-track -n 15 --no-pager 2>/dev/null | sed 's/^/    /'

section "4. PORTS (listening)"
for p in 80 443 8082 5023 5015 5055 3306; do
  line=$(ss -Hltnp "sport = :$p" 2>/dev/null | head -1)
  if [ -n "$line" ]; then ok "port $p listening  ($(echo "$line" | grep -o 'users:(("[^"]*"' | cut -d'"' -f2))"; else bad "port $p NOT listening"; fi
done
info "Open tracker connections on 5023 (GT06):"
ss -Htn "sport = :5023" 2>/dev/null | sed 's/^/    /' | head -10
[ -z "$(ss -Htn "sport = :5023" 2>/dev/null)" ] && info "    (none right now)"

section "5. FIREWALL"
ufw status 2>/dev/null | sed 's/^/  /' || info "ufw not available"

section "6. WEB / API"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:8082/api/server)
[ "$code" = 200 ] && ok "local API http://127.0.0.1:8082/api/server -> $code" || bad "local API -> $code"
domain=$(conf web.url | sed -E 's#^https?://##; s#/.*##')
if [ -n "$domain" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$domain/api/server")
  [ "$code" = 200 ] && ok "public https://$domain/api/server -> $code" || bad "public https://$domain -> $code"
  exp=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  [ -n "$exp" ] && info "SSL certificate valid until: $exp" || bad "could not read SSL certificate"
fi
nginx -t 2>&1 | sed 's/^/  /'

section "7. SERVER CONFIG (secrets masked)"
for k in web.url web.port gt06.port jt808.port osmand.port database.driver notificator.types \
         decoder.timezone geocoder.enable geocoder.type geocoder.onRequest geocoder.format \
         processing.copyAttributes.enable processing.copyAttributes filter.enable filter.invalid \
         filter.zero filter.duplicate filter.future filter.distance filter.maxSpeed report.ignoreOdometer \
         logger.level server.timeout; do
  v=$(conf "$k"); [ -n "$v" ] && info "$k = $v"
done
[ -n "$(conf database.password)" ] && info "database.password = (set, hidden)"
fb=$(conf notificator.firebase.serviceAccount)
if [ -n "$fb" ]; then ok "Firebase service account configured (hidden)"; else info "Firebase service account: not configured"; fi
[ -f /root/firebase-service-account.json ] && info "/root/firebase-service-account.json present, mode $(stat -c %a /root/firebase-service-account.json)"

section "8. DATABASE"
if mysql -u root "$DB" -e "SELECT 1" >/dev/null 2>&1; then ok "database $DB reachable"; else bad "database $DB not reachable"; fi
info "Counts: users=$(sql 'SELECT COUNT(*) FROM tc_users') devices=$(sql 'SELECT COUNT(*) FROM tc_devices') positions=$(sql 'SELECT COUNT(*) FROM tc_positions') events=$(sql 'SELECT COUNT(*) FROM tc_events') notifications=$(sql 'SELECT COUNT(*) FROM tc_notifications')"
info "Devices (id | name | IMEI | status | lastupdate UTC | positionid | model | phone):"
sql "SELECT id, name, uniqueid, status, lastupdate, positionid, model, phone FROM tc_devices" | sed 's/^/    /'
info "Server-wide time zone / map: $(sql "SELECT map, attributes FROM tc_servers" | head -c 300)"
info "Queued commands (should be empty unless waiting):"
q=$(sql "SELECT id, deviceid, type, attributes FROM tc_commands_queue"); [ -n "$q" ] && echo "$q" | sed 's/^/    /' || info "    (empty)"
info "Notifications (type | notificators | always):"
sql "SELECT type, notificators, always FROM tc_notifications" | sed 's/^/    /'
info "Users with push tokens: $(sql "SELECT COUNT(*) FROM tc_users WHERE attributes LIKE '%notificationTokens%'")"

section "9. LATEST POSITIONS PER DEVICE (UTC)"
for id in $(sql "SELECT id FROM tc_devices"); do
  info "Device $id - last 8 positions (id | servertime | devicetime | fixtime | valid | lat | lon | speed kn | attributes):"
  sql "SELECT id, servertime, devicetime, fixtime, valid, ROUND(latitude,5), ROUND(longitude,5), ROUND(speed,1), LEFT(attributes,160) FROM tc_positions WHERE deviceid=$id ORDER BY id DESC LIMIT 8" | sed 's/^/    /'
  info "Last position with a NEW GPS fix: $(sql "SELECT MAX(fixtime) FROM tc_positions WHERE deviceid=$id")"
  info "Positions stored in the last hour: $(sql "SELECT COUNT(*) FROM tc_positions WHERE deviceid=$id AND servertime > UTC_TIMESTAMP() - INTERVAL 1 HOUR")"
  info "Last 10 events (time UTC | type | attributes):"
  sql "SELECT eventtime, type, LEFT(attributes,80) FROM tc_events WHERE deviceid=$id ORDER BY id DESC LIMIT 10" | sed 's/^/    /'
done

section "10. TRACKER TRAFFIC (GT06, from the log)"
if [ -f "$LOG" ]; then
  info "Log file: $LOG ($(du -h "$LOG" | cut -f1))"
  python3 - "$LOG" <<'PY'
import re, sys, collections
names = {0x01: 'login', 0x10: 'gps', 0x11: 'lbs', 0x12: 'gps+lbs', 0x13: 'status/heartbeat', 0x16: 'gps+lbs+status (alarm)',
         0x17: 'lbs phone', 0x18: 'lbs extend', 0x19: 'lbs status', 0x1a: 'gps phone', 0x22: 'gps+lbs (2)', 0x26: 'alarm (gps+lbs+status)',
         0x27: 'alarm 2', 0x28: 'lbs multiple', 0x2a: 'gps address req', 0x8a: 'time request', 0x94: 'info', 0x15: 'command reply',
         0x21: 'command reply 2', 0x23: 'heartbeat 2', 0x2c: 'wifi', 0x80: 'command'}
inc, out = collections.Counter(), collections.Counter()
last_in, statuses, gps_times, logins = {}, [], [], []
rx = re.compile(r'^(\S+ \S+)\s+INFO: \[[^\]]*gt06 ([<>]) ([^\]]+)\] ([0-9a-f]+)$')
for line in open(sys.argv[1], errors='replace'):
    m = rx.match(line.strip())
    if not m:
        continue
    t, d, ip, hx = m.groups()
    try:
        b = bytes.fromhex(hx)
    except ValueError:
        continue
    if b[:2] == b'\x78\x78' and len(b) > 3:
        typ, data = b[3], b[4:]
    elif b[:2] == b'\x79\x79' and len(b) > 4:
        typ, data = b[4], b[5:]
    else:
        continue
    key = f'0x{typ:02x} {names.get(typ, "?")}'
    if d == '<':
        inc[key] += 1
        last_in[key] = t
        if typ == 0x01:
            logins.append((t, ip))
        if typ == 0x13 and len(data) >= 5:
            s = data[0]
            statuses.append((t, s, data[1], data[2], data[3], data[4]))
        if typ in (0x10, 0x12, 0x16, 0x1a, 0x22, 0x26, 0x27):
            gps_times.append(t)
    else:
        out[key] += 1
print('  Packets FROM tracker (count | last seen):')
for k, v in sorted(inc.items()):
    print(f'    {k:32s} {v:6d}   last {last_in[k]}')
print('  Packets TO tracker (server replies/commands):')
for k, v in sorted(out.items()):
    print(f'    {k:32s} {v:6d}')
print(f'  Last 10 logins (time, tracker IP): {logins[-10:]}')
print(f'  Last 10 GPS packets received: {gps_times[-10:] or "NONE"}')
print('  Last 15 heartbeat/status packets decoded:')
print('    time                 status  ACC  GPS-tracking  defense  charging  byte2  gsm  byte4(voltage 0.1V)  byte5')
for t, s, b2, gsm, b4, b5 in statuses[-15:]:
    print(f'    {t}  0x{s:02x}    {"ON " if s & 2 else "OFF"}  {"ON " if s & 64 else "OFF"}           '
          f'{"ON " if s & 1 else "OFF"}      {"yes" if s & 4 else "no "}       0x{b2:02x}   {gsm}    {b4} ({b4/10:.1f} V)          0x{b5:02x}')
PY
  info "Last 25 raw tracker lines:"
  grep -E "gt06 [<>]" "$LOG" | tail -25 | sed 's/^/    /'
else
  bad "log file not found: $LOG"
fi

section "11. ERRORS AND WARNINGS (last 40)"
if [ -f "$LOG" ]; then
  info "GT06-related warnings:"
  grep -E "WARN|ERROR" "$LOG" | grep -iE "gt06|Gt06" | tail -15 | sed 's/^/    /'
  info "All warnings/errors:"
  grep -E "WARN|ERROR" "$LOG" | tail -40 | cut -c1-260 | sed 's/^/    /'
  info "Notification results (last 15):"
  grep -E "Event id|Notification failed|XMart Sender|Firebase|Skipping" "$LOG" | tail -15 | cut -c1-260 | sed 's/^/    /'
fi

section "DONE"
info "Report saved to $OUT"
