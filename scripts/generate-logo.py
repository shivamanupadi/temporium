#!/usr/bin/env python3
"""
Temporium Logo Generator
Generates all brand assets matching sketchmat convention:
  - logo{32,64,128,192,256,512}.png  (tricolor, dark bg)
  - logo_coral.png, logo_lavender.png, logo_sage.png  (single-color variants at 512)
  - logo_tricolor.png  (master 512 tricolor)
  - favicon.ico, favicon.png, favicon-{16,32,48}x{16,32,48}.png
  - favicon.svg
  - apple-touch-icon.png
  - og.png  (1200x630 Open Graph)
  - twitter-banner.png  (1500x500)
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors
CORAL = (224, 122, 95)
LAVENDER = (155, 114, 207)
SAGE = (91, 154, 111)

# Light tints
CORAL_LIGHT = (255, 245, 240)
LAVENDER_LIGHT = (248, 244, 255)
SAGE_LIGHT = (240, 253, 244)

BG_DARK = (35, 35, 45)
CREAM = (253, 251, 248)
WHITE = (255, 255, 255)

OUTPUT = '/Users/shivaprasadmanupadi/devbox/projects/temporium/apps/home/public'


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def rounded_rect(draw, bbox, r, fill):
    x0, y0, x1, y1 = bbox
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    draw.pieslice([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=fill)
    draw.pieslice([x1 - 2*r, y0, x1, y0 + 2*r], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=fill)


def rounded_rect_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    rounded_rect(d, [0, 0, size-1, size-1], radius, 255)
    return mask


def bolt_points(s):
    cx = s * 0.5
    pad = s * 0.12
    return [
        (cx - s*0.02, pad),
        (cx + s*0.22, pad),
        (cx + s*0.06, s*0.42),
        (cx + s*0.24, s*0.42),
        (cx + s*0.02, s - pad),
        (cx - s*0.22, s - pad),
        (cx - s*0.06, s*0.58),
        (cx - s*0.24, s*0.58),
    ]


def bolt_mask(size):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).polygon(bolt_points(size), fill=255)
    return mask


def gradient_bolt(size, top_color, bottom_color, mid_color=None):
    if mid_color is None:
        mid_color = lerp(top_color, bottom_color, 0.5)
    mask = bolt_mask(size)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        t = y / max(size - 1, 1)
        if t < 0.5:
            c = lerp(top_color, mid_color, t * 2)
        else:
            c = lerp(mid_color, bottom_color, (t - 0.5) * 2)
        for x in range(size):
            if mask.getpixel((x, y)) > 0:
                img.putpixel((x, y), (*c, 255))
    return img


def solid_bolt(size, color):
    mask = bolt_mask(size)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for y in range(size):
        for x in range(size):
            if mask.getpixel((x, y)) > 0:
                img.putpixel((x, y), (*color, 255))
    return img


def make_icon(size, bolt_img, bg_color=BG_DARK, glow=True):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = int(size * 0.22)
    rounded_rect(draw, [0, 0, size-1, size-1], radius, bg_color)

    if glow and bg_color == BG_DARK:
        glow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow_layer)
        gs = int(size * 0.55)
        for i in range(gs, 0, -2):
            a = int(10 * (i / gs))
            gd.ellipse([size*0.05 - i//2, size*0.05 - i//2, size*0.05 + i//2, size*0.05 + i//2], fill=(*CORAL, a))
        for i in range(gs, 0, -2):
            a = int(8 * (i / gs))
            gd.ellipse([size*0.95 - i//2, size*0.95 - i//2, size*0.95 + i//2, size*0.95 + i//2], fill=(*SAGE, a))
        canvas = Image.alpha_composite(canvas, glow_layer)

    bs = int(size * 0.72)
    off = (size - bs) // 2
    canvas.paste(bolt_img.resize((bs, bs), Image.LANCZOS), (off, off), bolt_img.resize((bs, bs), Image.LANCZOS))
    return canvas


def get_font(size, bold=True):
    paths = [
        "/System/Library/Fonts/SFProText-Bold.otf" if bold else "/System/Library/Fonts/SFProText-Regular.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def text_width(draw, text, font):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0]


def create_og(master_icon):
    """OG image: 1200x630, layout like sketchmat — logo left, text right, warm bg."""
    w, h = 1200, 630
    img = Image.new('RGBA', (w, h), CREAM)
    draw = ImageDraw.Draw(img)

    # Subtle color orbs in background
    orb = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(orb)
    for r in range(350, 0, -3):
        a = int(8 * (r / 350))
        od.ellipse([80 - r, 100 - r, 80 + r, 100 + r], fill=(*CORAL, a))
    for r in range(300, 0, -3):
        a = int(6 * (r / 300))
        od.ellipse([1100 - r, 500 - r, 1100 + r, 500 + r], fill=(*SAGE, a))
    img = Image.alpha_composite(img, orb)
    draw = ImageDraw.Draw(img)

    # Logo icon on the left
    icon_size = 200
    icon = master_icon.resize((icon_size, icon_size), Image.LANCZOS)
    icon_x = 200
    icon_y = (h - icon_size) // 2
    img.paste(icon, (icon_x, icon_y), icon)

    # Text on the right
    font_title = get_font(56, bold=True)
    font_sub = get_font(22, bold=False)

    text_x = icon_x + icon_size + 80
    title_y = icon_y + 40
    draw.text((text_x, title_y), "Temporium", fill=(45, 52, 54, 255), font=font_title)
    draw.text((text_x, title_y + 75), "Tempo at Your Fingertips", fill=(107, 101, 96, 200), font=font_sub)

    # Three dots under subtitle
    dot_y = title_y + 130
    for i, c in enumerate([CORAL, LAVENDER, SAGE]):
        draw.ellipse([text_x + i*24 - 5, dot_y - 5, text_x + i*24 + 5, dot_y + 5], fill=(*c, 255))

    return img


def create_twitter_banner(master_icon):
    """Twitter/X banner: 1500x500."""
    w, h = 1500, 500
    img = Image.new('RGBA', (w, h), CREAM)
    draw = ImageDraw.Draw(img)

    # Subtle orbs
    orb = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(orb)
    for r in range(400, 0, -3):
        a = int(6 * (r / 400))
        od.ellipse([150 - r, 50 - r, 150 + r, 50 + r], fill=(*CORAL, a))
    for r in range(350, 0, -3):
        a = int(5 * (r / 350))
        od.ellipse([750 - r, 450 - r, 750 + r, 450 + r], fill=(*LAVENDER, a))
    for r in range(400, 0, -3):
        a = int(6 * (r / 400))
        od.ellipse([1350 - r, 80 - r, 1350 + r, 80 + r], fill=(*SAGE, a))
    img = Image.alpha_composite(img, orb)
    draw = ImageDraw.Draw(img)

    # Decorative line — tricolor gradient across top
    for x in range(w):
        t = x / w
        if t < 0.33:
            c = lerp(CORAL, LAVENDER, t * 3)
        elif t < 0.66:
            c = lerp(LAVENDER, SAGE, (t - 0.33) * 3)
        else:
            c = lerp(SAGE, SAGE, 0)
        draw.line([(x, 0), (x, 3)], fill=(*c, 180))

    # Center layout: icon + text
    icon_size = 120
    icon = master_icon.resize((icon_size, icon_size), Image.LANCZOS)

    font_title = get_font(52, bold=True)
    font_sub = get_font(20, bold=False)

    title_text = "Temporium"
    sub_text = "Tools for Tempo Blockchain"

    tw_title = text_width(draw, title_text, font_title)
    tw_sub = text_width(draw, sub_text, font_sub)

    gap = 36
    total_w = icon_size + gap + max(tw_title, tw_sub)
    start_x = (w - total_w) // 2

    icon_y = (h - icon_size) // 2
    img.paste(icon, (start_x, icon_y), icon)

    text_x = start_x + icon_size + gap
    draw.text((text_x, icon_y + 18), title_text, fill=(45, 52, 54, 255), font=font_title)
    draw.text((text_x, icon_y + 80), sub_text, fill=(107, 101, 96, 180), font=font_sub)

    # Three color dots bottom center
    dot_cx = w // 2
    dot_y = h - 40
    for i, c in enumerate([CORAL, LAVENDER, SAGE]):
        dx = dot_cx + (i - 1) * 22
        draw.ellipse([dx - 4, dot_y - 4, dx + 4, dot_y + 4], fill=(*c, 255))

    return img


def favicon_svg():
    return '''<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bolt-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E07A5F"/>
      <stop offset="50%" stop-color="#9B72CF"/>
      <stop offset="100%" stop-color="#5B9A6F"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="#23232D"/>
  <path d="M15.4 3.8 L22 3.8 L17.9 13.4 L24.7 13.4 L16.6 28.2 L10 28.2 L14.1 18.6 L7.3 18.6 Z" fill="url(#bolt-grad)"/>
</svg>'''


def main():
    os.makedirs(OUTPUT, exist_ok=True)

    # Remove old files that don't match new naming
    old_files = [
        'logo-dark.png', 'logo-light.png', 'logo-gradient.png',
        'logo-16.png', 'logo-32.png', 'logo-64.png', 'logo-128.png',
        'logo-192.png', 'logo-256.png', 'logo-512.png',
        'favicon-16x16.png', 'favicon-32x32.png', 'favicon-192x192.png', 'favicon-512x512.png',
        'full-logo-dark.png', 'full-logo-light.png', 'og-image.png',
    ]
    for f in old_files:
        p = os.path.join(OUTPUT, f)
        if os.path.exists(p):
            os.remove(p)
            print(f"  Removed old: {f}")

    # === Master bolt images at 512px ===
    print("\n--- Generating master bolts ---")
    tricolor_bolt = gradient_bolt(512, CORAL, SAGE, LAVENDER)
    coral_bolt = solid_bolt(512, CORAL)
    lavender_bolt = solid_bolt(512, LAVENDER)
    sage_bolt = solid_bolt(512, SAGE)

    # === logo_tricolor.png (512, dark bg) — the canonical logo ===
    master = make_icon(512, tricolor_bolt)
    master.save(os.path.join(OUTPUT, 'logo_tricolor.png'), 'PNG')
    print("  logo_tricolor.png")

    # === Single-color variants at 512 ===
    for name, b in [('coral', coral_bolt), ('lavender', lavender_bolt), ('sage', sage_bolt)]:
        icon = make_icon(512, b)
        icon.save(os.path.join(OUTPUT, f'logo_{name}.png'), 'PNG')
        print(f"  logo_{name}.png")

    # === Sized logos: logo32..logo512 (from tricolor master) ===
    print("\n--- Generating sized logos ---")
    for s in [32, 64, 128, 192, 256, 512]:
        resized = master.resize((s, s), Image.LANCZOS)
        resized.save(os.path.join(OUTPUT, f'logo{s}.png'), 'PNG')
        print(f"  logo{s}.png")

    # === Favicons ===
    print("\n--- Generating favicons ---")

    # favicon.png (64x64, like sketchmat)
    fav64 = master.resize((64, 64), Image.LANCZOS)
    fav64.save(os.path.join(OUTPUT, 'favicon.png'), 'PNG')
    print("  favicon.png (64x64)")

    # favicon-NNxNN.png
    for s in [16, 32, 48]:
        r = master.resize((s, s), Image.LANCZOS)
        r.save(os.path.join(OUTPUT, f'favicon-{s}x{s}.png'), 'PNG')
        print(f"  favicon-{s}x{s}.png")

    # favicon.ico (multi-size)
    ico_16 = master.resize((16, 16), Image.LANCZOS)
    ico_32 = master.resize((32, 32), Image.LANCZOS)
    ico_48 = master.resize((48, 48), Image.LANCZOS)
    ico_16.save(
        os.path.join(OUTPUT, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_32, ico_48],
    )
    print("  favicon.ico")

    # favicon.svg
    with open(os.path.join(OUTPUT, 'favicon.svg'), 'w') as f:
        f.write(favicon_svg())
    print("  favicon.svg")

    # apple-touch-icon.png (180x180)
    apple = master.resize((180, 180), Image.LANCZOS)
    apple.save(os.path.join(OUTPUT, 'apple-touch-icon.png'), 'PNG')
    print("  apple-touch-icon.png")

    # === OG image (1200x630) ===
    print("\n--- Generating OG image ---")
    og = create_og(master)
    og.save(os.path.join(OUTPUT, 'og.png'), 'PNG')
    print("  og.png (1200x630)")

    # === Twitter banner (1500x500) ===
    print("\n--- Generating Twitter banner ---")
    banner = create_twitter_banner(master)
    banner.save(os.path.join(OUTPUT, 'twitter-banner.png'), 'PNG')
    print("  twitter-banner.png (1500x500)")

    print(f"\nDone! All assets in: {OUTPUT}")


if __name__ == '__main__':
    main()
