#!/usr/bin/env bash
#
# XMart Track - single command installer for Ubuntu 22.04 / 24.04 (also Debian 12)
#
#   curl -fsSL https://raw.githubusercontent.com/xmarthost/XMart-Track/main/install.sh | sudo bash -s -- \
#        --domain xmarttrack.site --email you@example.com
#
# Options:
#   --domain NAME        Domain pointing to this VPS (required for HTTPS), e.g. xmarttrack.site
#   --email EMAIL        Email for the SSL certificate and the admin login (default admin@DOMAIN)
#   --admin-password P   Admin password (default: random, printed at the end)
#   --branch NAME        Git branch to install (default: main)
#   --no-ssl             Skip Let's Encrypt (use only plain HTTP)
#
# Running it again updates XMart Track to the latest code and keeps the database,
# the admin account and all settings.
#
set -euo pipefail

REPO_URL="https://github.com/xmarthost/XMart-Track.git"
BRANCH="main"
DOMAIN=""
EMAIL=""
ADMIN_PASSWORD=""
SSL=1
APP_DIR="/opt/xmart-track"
SRC_DIR="$APP_DIR/source"
CRED_FILE="/root/xmart-track-credentials.txt"
NODE_VERSION="22.13.1" # fallback; the newest Node 22 release is used when found
TIMEZONE="Asia/Karachi"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --no-ssl) SSL=0; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

log() { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
die() { echo -e "\033[1;31m[x] $*\033[0m"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root (use sudo)."
command -v apt-get >/dev/null || die "This installer supports Ubuntu/Debian only."

DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%%/*}"
[ -n "$EMAIL" ] || EMAIL="admin@${DOMAIN:-xmarttrack.local}"
PUBLIC_IP="$(curl -fsS4 --max-time 10 https://api.ipify.org || hostname -I | awk '{print $1}')"
HOST="${DOMAIN:-$PUBLIC_IP}"

random() {
  python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(${1:-20})))"
}

# ---------------------------------------------------------------- packages
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl git unzip xz-utils openssl python3 ufw nginx mariadb-server \
  openjdk-21-jdk-headless certbot python3-certbot-nginx

# the web build tools need Node 22.13 or newer; install the newest Node 22 release when older
node_ok() {
  command -v node >/dev/null && node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)'
}
if ! node_ok; then
  ARCH="$(uname -m)"; case "$ARCH" in x86_64) NARCH=x64 ;; aarch64) NARCH=arm64 ;; *) die "Unsupported CPU $ARCH" ;; esac
  LATEST="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt 2>/dev/null \
    | grep -o "node-v22\.[0-9.]*-linux-$NARCH\.tar\.xz" | head -1 | sed -E 's/node-v([0-9.]+)-.*/\1/')"
  [ -n "$LATEST" ] && NODE_VERSION="$LATEST"
  log "Installing Node.js $NODE_VERSION"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$NARCH.tar.xz" -o /tmp/node.tar.xz
  rm -rf /opt/node && mkdir -p /opt/node && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1
  ln -sf /opt/node/bin/node /usr/local/bin/node
  ln -sf /opt/node/bin/npm /usr/local/bin/npm
  ln -sf /opt/node/bin/npx /usr/local/bin/npx
fi

timedatectl set-timezone "$TIMEZONE" 2>/dev/null || true

# ---------------------------------------------------------------- source + build
log "Downloading XMart Track ($BRANCH)"
mkdir -p "$APP_DIR"
git config --global --get-all safe.directory 2>/dev/null | grep -qx "$SRC_DIR" \
  || git config --global --add safe.directory "$SRC_DIR"
if [ -d "$SRC_DIR/.git" ]; then
  chown -R root:root "$SRC_DIR"
  git -C "$SRC_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$SRC_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

log "Building server (this takes a few minutes the first time)"
(cd "$SRC_DIR" && chmod +x gradlew && ./gradlew assemble --no-daemon -q)

log "Building web interface"
(cd "$SRC_DIR/traccar-web" && npm ci --no-audit --no-fund --loglevel=error && npx vite build)

log "Installing files to $APP_DIR"
mkdir -p "$APP_DIR"/{conf,data,logs,media}
rm -rf "$APP_DIR/lib" "$APP_DIR/web" "$APP_DIR/schema" "$APP_DIR/templates"
cp "$SRC_DIR/target/tracker-server.jar" "$APP_DIR/"
cp -r "$SRC_DIR/target/lib" "$APP_DIR/lib"
cp -r "$SRC_DIR/schema" "$APP_DIR/schema"
cp -r "$SRC_DIR/templates" "$APP_DIR/templates"
cp -r "$SRC_DIR/traccar-web/build" "$APP_DIR/web"

# ---------------------------------------------------------------- database
FIRST_INSTALL=0
if [ ! -f "$APP_DIR/conf/traccar.xml" ]; then
  FIRST_INSTALL=1
  log "Creating database"
  DB_PASSWORD="$(random 24)"
  systemctl enable --now mariadb
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS xmarttrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'xmarttrack'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER 'xmarttrack'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON xmarttrack.* TO 'xmarttrack'@'localhost';
FLUSH PRIVILEGES;
SQL

  WEB_URL="http://$HOST"
  [ -n "$DOMAIN" ] && [ "$SSL" -eq 1 ] && WEB_URL="https://$DOMAIN"
  cat > "$APP_DIR/conf/traccar.xml" <<XML
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE properties SYSTEM 'http://java.sun.com/dtd/properties.dtd'>
<properties>
    <entry key='database.driver'>com.mysql.cj.jdbc.Driver</entry>
    <entry key='database.url'>jdbc:mysql://localhost/xmarttrack?zeroDateTimeBehavior=round&amp;serverTimezone=UTC&amp;allowPublicKeyRetrieval=true&amp;useSSL=false&amp;allowMultiQueries=true&amp;autoReconnect=true&amp;useUnicode=yes&amp;characterEncoding=UTF-8&amp;sessionVariables=sql_mode=''</entry>
    <entry key='database.user'>xmarttrack</entry>
    <entry key='database.password'>$DB_PASSWORD</entry>

    <entry key='web.port'>8082</entry>
    <entry key='web.path'>./web</entry>
    <entry key='web.url'>$WEB_URL</entry>
    <entry key='web.persistSession'>true</entry>

    <entry key='notificator.types'>web,sms,command,xmwhatsapp</entry>

    <entry key='geocoder.enable'>true</entry>
    <entry key='geocoder.type'>nominatim</entry>
    <entry key='geocoder.onRequest'>true</entry>

    <entry key='logger.file'>./logs/tracker-server.log</entry>
    <entry key='media.path'>./media</entry>
</properties>
XML
  chmod 600 "$APP_DIR/conf/traccar.xml"
fi

# ---------------------------------------------------------------- config updates
# Applied on every run so updates bring new settings to existing installations.
set_config() {
  python3 - "$APP_DIR/conf/traccar.xml" "$1" "$2" <<'PY'
import re, sys
from xml.sax.saxutils import escape
path, key, value = sys.argv[1:4]
text = open(path, encoding='utf-8').read()
entry = "<entry key='%s'>%s</entry>" % (key, escape(value))
pattern = re.compile(r"<entry key=['\"]%s['\"]>.*?</entry>" % re.escape(key), re.S)
if pattern.search(text):
    text = pattern.sub(lambda _: entry, text)
else:
    text = text.replace("</properties>", "    %s\n</properties>" % entry)
open(path, 'w', encoding='utf-8').write(text)
PY
}
log "Updating server settings"
# Firebase push notifications for the mobile app: enabled when the service account key is on the server
FIREBASE_KEY="/root/firebase-service-account.json"
NOTIFICATORS='web,sms,command,xmwhatsapp'
if [ -f "$FIREBASE_KEY" ]; then
  chmod 600 "$FIREBASE_KEY"
  if python3 -c "import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get('type')=='service_account' and d.get('private_key') else 1)" "$FIREBASE_KEY"; then
    set_config notificator.firebase.serviceAccount "$(cat "$FIREBASE_KEY")"
    NOTIFICATORS="$NOTIFICATORS,firebase"
    # alerts saved from the SMS & WhatsApp page also go to the app from now on
    if [ "$FIRST_INSTALL" -eq 0 ]; then
      mysql -u root xmarttrack -e "UPDATE tc_notifications SET notificators=CONCAT(notificators, ',firebase') WHERE attributes LIKE '%xmSms%' AND notificators NOT LIKE '%firebase%';" 2>/dev/null || true
    fi
    log "Firebase push notifications enabled"
  else
    warn "$FIREBASE_KEY is not a Firebase service account key; push notifications stay off"
  fi
fi
set_config notificator.types "$NOTIFICATORS"
set_config geocoder.format '%f'
set_config geocoder.cacheSize '20000'
set_config processing.copyAttributes.enable 'true'
set_config processing.copyAttributes 'power,adc1,battery,batteryLevel,ignition,sat,rssi,charge,blocked,odometer'
# GT06/WanWay trackers send UTC times; after a GMT,E,5,0# command they still report UTC but announce
# +5 h at login, which shifted every position/event 5 h into the past (and blocked alerts as "old").
set_config decoder.timezone 'UTC'
# GT06 trackers often drop and re-open the connection (network or power saving); do not flip
# the vehicle to "offline" on every short disconnect (it becomes "unknown" after the status timeout)
set_config status.ignoreOffline 'gt06'
# old installs used OpenFreeMap as the default map; switch them to Google Road
if [ "$FIRST_INSTALL" -eq 0 ]; then
  mysql -u root xmarttrack -e "UPDATE tc_servers SET map='googleRoad' WHERE map IS NULL OR map='openFreeMap';" 2>/dev/null || true
fi

# ---------------------------------------------------------------- service
log "Configuring service"
id xmarttrack >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin xmarttrack
chown xmarttrack:xmarttrack "$APP_DIR"
for item in "$APP_DIR"/*; do
  [ "$item" = "$SRC_DIR" ] || chown -R xmarttrack:xmarttrack "$item"
done
cat > /etc/systemd/system/xmart-track.service <<UNIT
[Unit]
Description=XMart Track GPS server
After=network.target mariadb.service
Requires=mariadb.service

[Service]
Type=simple
User=xmarttrack
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/java -Xms256m -Xmx1g -XX:+ExitOnOutOfMemoryError -jar tracker-server.jar conf/traccar.xml
AmbientCapabilities=CAP_NET_BIND_SERVICE
SuccessExitStatus=143
Restart=on-failure
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable xmart-track >/dev/null
systemctl restart xmart-track

log "Waiting for XMart Track to start"
for _ in $(seq 1 90); do
  curl -fs -o /dev/null http://127.0.0.1:8082/ && break
  sleep 2
done
curl -fs -o /dev/null http://127.0.0.1:8082/ || die "Server did not start. Check: journalctl -u xmart-track -n 100"

# ---------------------------------------------------------------- nginx + ssl
log "Configuring web server (nginx)"
SERVER_NAMES="${DOMAIN:-_}"
[ -n "$DOMAIN" ] && SERVER_NAMES="$DOMAIN www.$DOMAIN"
cat > /etc/nginx/sites-available/xmart-track <<NGINX
server {
    listen 80;
    server_name $SERVER_NAMES;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    location /api/socket {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/xmart-track /etc/nginx/sites-enabled/xmart-track
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

log "Configuring firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 5023/tcp >/dev/null   # GT06 / WanWay G19S
ufw allow 5015/tcp >/dev/null   # JT808
ufw allow 5055/tcp >/dev/null   # OsmAnd / phone apps
ufw --force enable >/dev/null

SSL_STATUS="not configured"
if [ -n "$DOMAIN" ] && [ "$SSL" -eq 1 ]; then
  DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
  if [ "$DNS_IP" = "$PUBLIC_IP" ]; then
    log "Getting SSL certificate for $DOMAIN"
    DOMAINS=(-d "$DOMAIN")
    WWW_IP="$(getent ahostsv4 "www.$DOMAIN" | awk 'NR==1{print $1}')"
    [ "$WWW_IP" = "$PUBLIC_IP" ] && DOMAINS+=(-d "www.$DOMAIN")
    if certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL" "${DOMAINS[@]}"; then
      SSL_STATUS="enabled (auto renew)"
    else
      warn "SSL certificate failed. Run later: certbot --nginx -d $DOMAIN"
    fi
  else
    warn "DNS for $DOMAIN points to '${DNS_IP:-nothing}', not to this VPS ($PUBLIC_IP)."
    warn "Add an A record for $DOMAIN -> $PUBLIC_IP, wait a few minutes, then run this installer again."
  fi
fi

# ---------------------------------------------------------------- admin account + defaults
API="http://127.0.0.1:8082/api"
if [ "$FIRST_INSTALL" -eq 1 ] || [ ! -f "$CRED_FILE" ]; then
  [ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(random 14)"
  log "Creating admin account"
  curl -fs -X POST "$API/users" -H 'Content-Type: application/json' \
    -d "{\"name\":\"Admin\",\"email\":\"$EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" >/dev/null \
    || warn "Admin account already exists; password unchanged."

  log "Applying XMart Track defaults"
  SERVER_JSON="$(curl -fs -u "$EMAIL:$ADMIN_PASSWORD" "$API/server" || true)"
  if [ -n "$SERVER_JSON" ]; then
    UPDATED="$(echo "$SERVER_JSON" | python3 -c "
import json, sys
s = json.load(sys.stdin)
s['registration'] = False
s['map'] = 'googleRoad'
a = s.setdefault('attributes', {})
a.update({'timezone': '$TIMEZONE', 'speedUnit': 'kmh', 'distanceUnit': 'km',
          'xm.deviceHost': '$HOST', 'title': 'XMart Track'})
print(json.dumps(s))
")"
    curl -fs -X PUT -u "$EMAIL:$ADMIN_PASSWORD" -H 'Content-Type: application/json' \
      -d "$UPDATED" "$API/server" >/dev/null || warn "Could not apply defaults."
  fi

  cat > "$CRED_FILE" <<CRED
XMart Track - installation details ($(date '+%Y-%m-%d %H:%M'))

Web panel     : $( [ "$SSL_STATUS" = "enabled (auto renew)" ] && echo "https://$HOST" || echo "http://$HOST" )
Admin email   : $EMAIL
Admin password: $ADMIN_PASSWORD

Tracker server: $HOST
GT06 / G19S   : port 5023
JT808         : port 5015
Set server SMS: SERVER,1,$HOST,5023,0#

Database      : MariaDB, name xmarttrack, user xmarttrack (password in $APP_DIR/conf/traccar.xml)
Install path  : $APP_DIR
Service       : systemctl status|restart xmart-track
Logs          : $APP_DIR/logs/tracker-server.log  (or journalctl -u xmart-track)
Update        : run the same install command again
CRED
  chmod 600 "$CRED_FILE"
fi

log "Done"
echo
cat "$CRED_FILE"
echo
echo "SSL: $SSL_STATUS"
echo "These details are saved in $CRED_FILE"
