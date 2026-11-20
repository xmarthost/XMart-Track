# XMart Track – VPS installation

## Requirements
- A VPS with **Ubuntu 22.04 or 24.04** (Debian 12 also works), 2 GB RAM or more, root/sudo access
- Domain **xmarttrack.site** with DNS A records pointing to the VPS public IP:
  - `xmarttrack.site` → VPS IP
  - `www.xmarttrack.site` → VPS IP (optional)

## Install (one command)

```bash
curl -fsSL https://raw.githubusercontent.com/xmarthost/XMart-Track/main/install.sh | sudo bash -s -- --domain xmarttrack.site --email you@example.com
```

Options:

| Option | Meaning |
|---|---|
| `--domain` | Domain for the panel and trackers |
| `--email` | Admin login email and SSL certificate email |
| `--admin-password` | Choose the admin password (otherwise a random one is generated) |
| `--branch` | Install a different git branch |
| `--no-ssl` | Skip HTTPS |

The installer:
1. Installs Java 21, Node.js, MariaDB, nginx, certbot and the firewall
2. Builds XMart Track from this repository
3. Creates the database with a random password
4. Runs XMart Track as the `xmart-track` systemd service (starts on boot)
5. Configures nginx and a free Let's Encrypt SSL certificate (auto renew)
6. Opens ports 22, 80, 443, 5023 (GT06 / WanWay G19S), 5015 (JT808), 5055 (phone apps)
7. Creates the admin account, disables public registration and sets defaults
   (Asia/Karachi timezone, km/h, OpenFreeMap, tracker host = your domain)

At the end it prints the panel URL, admin email and password. They are also saved in
`/root/xmart-track-credentials.txt`.

## Update
Run the same command again. Database, admin account and settings are kept.

## Useful commands

```bash
systemctl status xmart-track
```

```bash
systemctl restart xmart-track
```

```bash
tail -f /opt/xmart-track/logs/tracker-server.log
```

```bash
cat /root/xmart-track-credentials.txt
```

## After installation
1. Open `https://xmarttrack.site` and log in with the admin details.
2. **Admin → API & Integrations**: add map API keys (optional) and the SMS gateway (optional).
3. **Monitor → +**: paste the tracker IMEI and send the shown SMS commands to the tracker SIM.
4. **SMS Alerts**: add mobile numbers and turn on ACC ON/OFF alerts.
