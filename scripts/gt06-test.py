#!/usr/bin/env python3
"""Minimal GT06 test server to see how a tracker behaves with different replies.

Usage:  python3 gt06-test.py <port> <mode>
  mode all   : reply to every packet (like the main server)
  mode nogps : reply to login/heartbeat/alarm but not to GPS packets (0x10/0x12/0x22)
  mode none  : reply only to login
Point the tracker here by SMS:  SERVER,0,<server ip>,<port>,0#   (and back to 5023 afterwards)
Stop with Ctrl+C. Nothing is stored; every packet is printed with the time.
"""
import asyncio
import sys
from datetime import datetime

GPS_TYPES = {0x10, 0x12, 0x22}
NAMES = {0x01: 'login', 0x13: 'heartbeat', 0x12: 'gps', 0x22: 'gps', 0x16: 'alarm', 0x26: 'alarm',
         0x94: 'info', 0x21: 'reply', 0x15: 'reply', 0x8a: 'time-request'}


def crc_x25(data):
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0x8408 if crc & 1 else crc >> 1
    return crc ^ 0xFFFF


def response(ptype, serial):
    body = bytes([0x05, ptype]) + serial
    return b'\x78\x78' + body + crc_x25(body).to_bytes(2, 'big') + b'\x0d\x0a'


def now():
    return datetime.now().strftime('%H:%M:%S')


def describe(ptype, data):
    name = NAMES.get(ptype, '?')
    if ptype in GPS_TYPES and len(data) >= 26:
        d = data
        when = f'20{d[0]:02d}-{d[1]:02d}-{d[2]:02d} {d[3]:02d}:{d[4]:02d}:{d[5]:02d} UTC'
        lat = int.from_bytes(d[7:11], 'big') / 1800000
        lon = int.from_bytes(d[11:15], 'big') / 1800000
        speed = d[15]
        tail = d[-5:]
        return f'{name} fix {when} lat {lat:.5f} lon {lon:.5f} speed {speed} km/h sats {d[6] & 0x0f} tail {tail.hex()}'
    if ptype == 0x13 and len(data) >= 5:
        s = data[0]
        return (f'{name} status 0x{s:02x} ACC {"ON" if s & 2 else "OFF"} GPS {"ON" if s & 64 else "OFF"} '
                f'defense {"ON" if s & 1 else "OFF"} voltage {data[3] / 10:.1f} V')
    return name


async def handle(reader, writer, mode):
    peer = writer.get_extra_info('peername')
    opened = datetime.now()
    print(f'{now()}  CONNECT  {peer[0]}', flush=True)
    buf = b''
    try:
        while True:
            chunk = await reader.read(1024)
            if not chunk:
                print(f'{now()}  CLOSED by tracker (after {(datetime.now() - opened).seconds} s)', flush=True)
                break
            buf += chunk
            while len(buf) >= 5:
                if buf[:2] == b'\x78\x78':
                    length = buf[2]
                    total = length + 5
                    if len(buf) < total:
                        break
                    packet, buf = buf[:total], buf[total:]
                    ptype, data = packet[3], packet[4:-6]
                elif buf[:2] == b'\x79\x79':
                    length = int.from_bytes(buf[2:4], 'big')
                    total = length + 6
                    if len(buf) < total:
                        break
                    packet, buf = buf[:total], buf[total:]
                    ptype, data = packet[4], packet[5:-6]
                else:
                    buf = buf[1:]
                    continue
                serial = packet[-6:-4]
                reply = (mode == 'all' or ptype == 0x01
                         or (mode == 'nogps' and ptype not in GPS_TYPES and ptype != 0x94))
                print(f'{now()}  <- {describe(ptype, data)}   [{packet.hex()}]', flush=True)
                if reply and packet[:2] == b'\x78\x78':
                    out = response(ptype, serial)
                    writer.write(out)
                    await writer.drain()
                    print(f'{now()}  -> ack 0x{ptype:02x}', flush=True)
    except ConnectionResetError:
        print(f'{now()}  RESET by tracker (after {(datetime.now() - opened).seconds} s)', flush=True)
    finally:
        writer.close()


async def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5099
    mode = sys.argv[2] if len(sys.argv) > 2 else 'nogps'
    server = await asyncio.start_server(lambda r, w: handle(r, w, mode), '0.0.0.0', port)
    print(f'GT06 test server on port {port}, mode "{mode}". Waiting for the tracker... (Ctrl+C to stop)', flush=True)
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\nstopped')
