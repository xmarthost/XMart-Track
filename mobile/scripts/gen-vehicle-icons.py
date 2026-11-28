#!/usr/bin/env python3
"""Draws the top-down vehicle icons used on the map (original artwork, facing up = north).

Writes assets/vehicles/<type>-<color>.png (96 px) and src/map/vehicleIcons.js (the require() table).
Run from mobile/:  python3 scripts/gen-vehicle-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

S = 512          # drawing canvas
OUT = 96         # final icon size
CX = S // 2

COLORS = {
    # status colours (used when the vehicle shows its state)
    'green': '#16A34A', 'blue': '#2563EB', 'red': '#DC2626', 'gray': '#94A3B8',
    # fixed colours
    'black': '#1F2937', 'white': '#F8FAFC', 'silver': '#CBD5E1', 'yellow': '#FACC15',
    'orange': '#F97316', 'purple': '#7C3AED', 'maroon': '#9F1239', 'teal': '#0D9488',
}
GLASS = (30, 41, 59, 255)
TYRE = (17, 24, 39, 255)
LIGHT = (254, 249, 195, 255)


def rgb(hex_color):
    h = hex_color.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(color, factor):
    return tuple(max(0, min(255, int(c * factor))) for c in color[:3]) + (255,)


class Pen:
    def __init__(self, draw, body):
        self.d = draw
        self.body = body
        self.edge = shade(body, 0.55)
        self.roof = shade(body, 1.12) if sum(body[:3]) < 600 else shade(body, 0.92)

    def box(self, x0, y0, x1, y1, r, fill=None, outline=True):
        self.d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill or self.body,
                                 outline=self.edge if outline else None, width=8 if outline else 0)

    def glass(self, pts):
        self.d.polygon(pts, fill=GLASS)

    def wheel(self, x, y, w=26, h=56):
        self.d.rounded_rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], radius=8, fill=TYRE)

    def lights(self, y, half):
        for sx in (-1, 1):
            self.d.ellipse([CX + sx * half - 14, y - 8, CX + sx * half + 14, y + 8], fill=LIGHT)


def car_like(p, w, h, roof_len, front=0.22, rails=False):
    x0, x1 = CX - w / 2, CX + w / 2
    y0, y1 = CX - h / 2, CX + h / 2
    for wy in (y0 + h * 0.2, y1 - h * 0.2):
        p.wheel(x0 + 2, wy)
        p.wheel(x1 - 2, wy)
    p.box(x0, y0, x1, y1, w * 0.32)
    ws_top = y0 + h * front
    ws_bot = ws_top + h * 0.13
    p.glass([(x0 + 22, ws_bot), (x1 - 22, ws_bot), (x1 - 34, ws_top), (x0 + 34, ws_top)])
    roof_top = ws_bot + 6
    p.box(x0 + 26, roof_top, x1 - 26, roof_top + h * roof_len, 26, fill=p.roof, outline=False)
    rear = roof_top + h * roof_len + 6
    p.glass([(x0 + 30, rear), (x1 - 30, rear), (x1 - 40, rear + h * 0.08), (x0 + 40, rear + h * 0.08)])
    if rails:
        for sx in (x0 + 34, x1 - 40):
            p.d.rectangle([sx, roof_top + 14, sx + 6, roof_top + h * roof_len - 14], fill=p.edge)
    p.lights(y0 + 18, w / 2 - 34)


def sedan(p):
    car_like(p, 196, 400, 0.30)


def suv(p):
    car_like(p, 222, 410, 0.36, front=0.18, rails=True)


def pickup(p):
    w, h = 214, 430
    x0, x1, y0, y1 = CX - w / 2, CX + w / 2, CX - h / 2, CX + h / 2
    for wy in (y0 + h * 0.18, y1 - h * 0.2):
        p.wheel(x0 + 2, wy)
        p.wheel(x1 - 2, wy)
    p.box(x0, y0, x1, y1, 50)
    p.glass([(x0 + 22, y0 + 130), (x1 - 22, y0 + 130), (x1 - 34, y0 + 84), (x0 + 34, y0 + 84)])
    p.box(x0 + 24, y0 + 136, x1 - 24, y0 + 214, 20, fill=p.roof, outline=False)
    p.box(x0 + 20, y0 + 236, x1 - 20, y1 - 18, 12, fill=shade(p.body, 0.7), outline=False)
    p.lights(y0 + 18, w / 2 - 34)


def van(p):
    w, h = 224, 440
    x0, x1, y0, y1 = CX - w / 2, CX + w / 2, CX - h / 2, CX + h / 2
    for wy in (y0 + h * 0.16, y1 - h * 0.18):
        p.wheel(x0 + 2, wy)
        p.wheel(x1 - 2, wy)
    p.box(x0, y0, x1, y1, 46)
    p.glass([(x0 + 20, y0 + 92), (x1 - 20, y0 + 92), (x1 - 30, y0 + 48), (x0 + 30, y0 + 48)])
    p.box(x0 + 22, y0 + 100, x1 - 22, y1 - 22, 18, fill=p.roof, outline=False)
    p.lights(y0 + 16, w / 2 - 32)


def bus(p):
    w, h = 220, 476
    x0, x1, y0, y1 = CX - w / 2, CX + w / 2, CX - h / 2, CX + h / 2
    for wy in (y0 + h * 0.15, y1 - h * 0.17):
        p.wheel(x0 + 2, wy)
        p.wheel(x1 - 2, wy)
    p.box(x0, y0, x1, y1, 28)
    p.glass([(x0 + 18, y0 + 58), (x1 - 18, y0 + 58), (x1 - 22, y0 + 24), (x0 + 22, y0 + 24)])
    p.box(x0 + 20, y0 + 66, x1 - 20, y1 - 20, 12, fill=p.roof, outline=False)
    p.box(CX - 50, CX - 40, CX + 50, CX + 40, 10, fill=shade(p.body, 0.8), outline=False)
    p.lights(y0 + 12, w / 2 - 30)


def truck(p, tank=False):
    w, h = 212, 480
    x0, x1, y0, y1 = CX - w / 2, CX + w / 2, CX - h / 2, CX + h / 2
    for wy in (y0 + 70, y1 - 110, y1 - 50):
        p.wheel(x0 + 2, wy)
        p.wheel(x1 - 2, wy)
    p.box(x0 + 8, y0, x1 - 8, y0 + 130, 34)
    p.glass([(x0 + 26, y0 + 76), (x1 - 26, y0 + 76), (x1 - 36, y0 + 40), (x0 + 36, y0 + 40)])
    p.lights(y0 + 14, w / 2 - 40)
    if tank:
        p.box(x0, y0 + 146, x1, y1, 100, fill=shade(p.body, 0.9))
        p.d.rectangle([CX - 8, y0 + 170, CX + 8, y1 - 26], fill=shade(p.body, 1.25) if sum(p.body[:3]) < 600 else shade(p.body, 0.8))
    else:
        p.box(x0, y0 + 146, x1, y1, 14, fill=(203, 213, 225, 255))
        p.d.rectangle([x0 + 18, y0 + 160, x1 - 18, y0 + 172], fill=p.body)


def tanker(p):
    truck(p, tank=True)


def tractor(p):
    p.wheel(CX - 112, CX + 80, 60, 150)
    p.wheel(CX + 112, CX + 80, 60, 150)
    p.wheel(CX - 70, CX - 140, 34, 80)
    p.wheel(CX + 70, CX - 140, 34, 80)
    p.box(CX - 50, CX - 210, CX + 50, CX + 10, 26)
    p.box(CX - 80, CX + 10, CX + 80, CX + 170, 28)
    p.glass([(CX - 60, CX + 40), (CX + 60, CX + 40), (CX + 60, CX + 70), (CX - 60, CX + 70)])
    p.lights(CX - 196, 26)


def excavator(p):
    for sx in (-1, 1):
        p.d.rounded_rectangle([CX + sx * 120 - 34, CX - 150, CX + sx * 120 + 34, CX + 190], radius=24, fill=TYRE)
    p.box(CX - 110, CX - 80, CX + 110, CX + 170, 30)
    p.box(CX - 26, CX - 236, CX + 26, CX - 70, 14, fill=shade(p.body, 0.85))
    p.d.rectangle([CX - 46, CX - 250, CX + 46, CX - 222], fill=TYRE)
    p.glass([(CX + 20, CX - 60), (CX + 96, CX - 60), (CX + 96, CX + 20), (CX + 20, CX + 20)])


def rickshaw(p):
    p.wheel(CX, CX - 170, 30, 66)
    p.wheel(CX - 112, CX + 120)
    p.wheel(CX + 112, CX + 120)
    p.d.polygon([(CX - 50, CX - 200), (CX + 50, CX - 200), (CX + 120, CX - 40), (CX + 120, CX + 190),
                 (CX - 120, CX + 190), (CX - 120, CX - 40)], fill=p.body, outline=p.edge)
    p.box(CX - 104, CX - 40, CX + 104, CX + 176, 34, fill=(17, 24, 39, 255) if sum(p.body[:3]) > 300 else (226, 232, 240, 255), outline=False)
    p.glass([(CX - 70, CX - 70), (CX + 70, CX - 70), (CX + 40, CX - 150), (CX - 40, CX - 150)])
    p.lights(CX - 190, 16)


def motorcycle(p):
    p.wheel(CX, CX - 170, 34, 110)
    p.wheel(CX, CX + 160, 40, 120)
    p.box(CX - 44, CX - 110, CX + 44, CX + 120, 40)
    p.d.rounded_rectangle([CX - 110, CX - 128, CX + 110, CX - 112], radius=8, fill=TYRE)
    p.box(CX - 30, CX - 10, CX + 30, CX + 96, 26, fill=GLASS, outline=False)
    p.d.ellipse([CX - 14, CX - 226, CX + 14, CX - 206], fill=LIGHT)


def bicycle(p):
    p.wheel(CX, CX - 150, 16, 130)
    p.wheel(CX, CX + 150, 16, 130)
    p.box(CX - 14, CX - 110, CX + 14, CX + 110, 10)
    p.d.rounded_rectangle([CX - 92, CX - 100, CX + 92, CX - 86], radius=6, fill=TYRE)
    p.box(CX - 26, CX + 20, CX + 26, CX + 70, 16, fill=GLASS, outline=False)


def boat(p):
    p.d.polygon([(CX, CX - 236), (CX + 110, CX - 80), (CX + 110, CX + 200), (CX - 110, CX + 200),
                 (CX - 110, CX - 80)], fill=p.body, outline=p.edge)
    p.d.polygon([(CX, CX - 190), (CX + 80, CX - 70), (CX + 80, CX + 176), (CX - 80, CX + 176),
                 (CX - 80, CX - 70)], fill=p.roof)
    p.glass([(CX - 60, CX - 30), (CX + 60, CX - 30), (CX + 60, CX + 40), (CX - 60, CX + 40)])


def person(p):
    p.d.ellipse([CX - 130, CX - 40, CX + 130, CX + 170], fill=p.body, outline=p.edge, width=8)
    p.d.ellipse([CX - 72, CX - 200, CX + 72, CX - 56], fill=p.roof, outline=p.edge, width=8)
    p.d.polygon([(CX - 30, CX - 196), (CX + 30, CX - 196), (CX, CX - 236)], fill=p.edge)


TYPES = [
    ('sedan', 'Car', sedan), ('suv', 'SUV / Jeep', suv), ('pickup', 'Pickup', pickup), ('van', 'Van / Hiace', van),
    ('bus', 'Bus / Coaster', bus), ('truck', 'Truck', truck), ('tanker', 'Tanker', tanker), ('tractor', 'Tractor', tractor),
    ('excavator', 'Excavator', excavator), ('rickshaw', 'Rickshaw', rickshaw), ('motorcycle', 'Motorcycle', motorcycle),
    ('bicycle', 'Bicycle', bicycle), ('boat', 'Boat', boat), ('person', 'Person', person),
]


def draw(fn, color):
    shape = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    fn(Pen(ImageDraw.Draw(shape), rgb(color)))
    # soft shadow in the vehicle's own outline, slightly below it
    alpha = shape.getchannel('A').point(lambda a: 80 if a > 0 else 0)
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow.putalpha(alpha)
    shadow = shadow.transform((S, S), Image.AFFINE, (1, 0, 0, 0, 1, -10)).filter(ImageFilter.GaussianBlur(10))
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    img.alpha_composite(shadow)
    img.alpha_composite(shape)
    return img.resize((OUT, OUT), Image.LANCZOS)


def main():
    out_dir = 'assets/vehicles'
    os.makedirs(out_dir, exist_ok=True)
    lines = ['// Generated by scripts/gen-vehicle-icons.py: do not edit by hand.', '/* eslint-disable */',
             'export const vehicleTypes = [']
    for key, label, _ in TYPES:
        lines.append(f"  {{ key: '{key}', label: '{label}' }},")
    lines.append('];')
    lines.append(f"export const iconColors = {{ {', '.join(f'{k}: {chr(39)}{v}{chr(39)}' for k, v in COLORS.items())} }};")
    lines.append('export const vehicleImages = {')
    for key, _, fn in TYPES:
        for name, color in COLORS.items():
            draw(fn, color).save(f'{out_dir}/{key}-{name}.png', optimize=True)
            lines.append(f"  '{key}-{name}': require('../../assets/vehicles/{key}-{name}.png'),")
    lines.append('};')
    open('src/map/vehicleIcons.js', 'w').write('\n'.join(lines) + '\n')
    print(f'{len(TYPES) * len(COLORS)} icons written')


if __name__ == '__main__':
    main()
