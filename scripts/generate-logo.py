#!/usr/bin/env python3
"""
Temporium Logo Generator

The mark: a metronome and a coin — an ink metronome body, a light-coral
needle mid-swing, and a coral disc as the sliding weight, bleeding past the
body's edge. Tempo (the chain) + a wallet, in three flat geometric shapes.
Same family as the PayWeave P and the Papermint sheet.

Generates the assets served from apps/wallet/web/public:
  - logo.svg                       (master vector, used by headers)
  - logo-dark.svg                  (cream body, for dark backgrounds)
  - logo-mono.svg                  (single-color ink, for print/embeds)
  - logo{32,64,128,192,256,512}.png (raster mark, transparent)
  - logo-dark512.png               (raster of the dark-background variant)
  - favicon.svg, favicon.ico, favicon-{16,32}x*.png
  - favicon-{192,512}x*.png        (PWA manifest, opaque cream tile)
  - apple-touch-icon.png           (opaque cream tile)
  - og-image.png                   (1200x630 Open Graph)
  - twitter-banner.png             (1500x500 X profile banner)

Run:  python3 scripts/generate-logo.py   (needs Pillow)
"""

import os

from PIL import Image, ImageDraw, ImageFont

# Brand colors
CORAL = (224, 122, 95)  # #E07A5F
CORAL_LIGHT = (240, 176, 152)  # #F0B098
LAVENDER = (155, 114, 207)
SAGE = (107, 143, 113)
INK = (45, 52, 54)  # #2D3436
INK_2 = (107, 101, 96)
CREAM = (253, 251, 248)  # #FDFBF8
WHITE = (255, 255, 255)

OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'apps', 'wallet', 'web', 'public')

# ── Mark geometry (fractions of the canvas) ───────────────────────────
#
# Trapezoid body, needle from a pivot near the base up to the top right,
# disc (the weight) riding the needle and overhanging the body's edge.
BODY = [(0.1875, 0.906), (0.656, 0.906), (0.547, 0.094), (0.297, 0.094)]
NEEDLE_A = (0.422, 0.828)  # pivot
NEEDLE_B = (0.734, 0.172)  # tip
NEEDLE_W = 0.0703
DISC_C = (0.633, 0.383)
DISC_R = 0.172


def draw_mark(draw, s, body_color=INK, disc_color=CORAL, needle_color=CORAL_LIGHT):
    draw.polygon([(x * s, y * s) for x, y in BODY], fill=(*body_color, 255))

    ax, ay = NEEDLE_A[0] * s, NEEDLE_A[1] * s
    bx, by = NEEDLE_B[0] * s, NEEDLE_B[1] * s
    w = NEEDLE_W * s
    draw.line([(ax, ay), (bx, by)], fill=(*needle_color, 255), width=int(round(w)))
    for x, y in ((ax, ay), (bx, by)):
        draw.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=(*needle_color, 255))

    cx, cy, r = DISC_C[0] * s, DISC_C[1] * s, DISC_R * s
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*disc_color, 255))


def make_icon(size, background=None, supersample=4, pad=0.0, **colors):
    """Mark on a transparent (or solid) square. `pad` insets the mark."""
    s = size * supersample
    bg = (0, 0, 0, 0) if background is None else (*background, 255)
    canvas = Image.new('RGBA', (s, s), bg)
    if pad:
        inner = int(s * (1 - 2 * pad))
        layer = Image.new('RGBA', (inner, inner), (0, 0, 0, 0))
        draw_mark(ImageDraw.Draw(layer), inner, **colors)
        off = (s - inner) // 2
        canvas.alpha_composite(layer, (off, off))
    else:
        draw_mark(ImageDraw.Draw(canvas), s, **colors)
    return canvas.resize((size, size), Image.LANCZOS)


def logo_svg(size=64, body='#2D3436', needle='#F0B098', disc='#E07A5F'):
    s = size
    pts = ' '.join(f'{x * s:.2f},{y * s:.2f}' for x, y in BODY)
    ax, ay = NEEDLE_A[0] * s, NEEDLE_A[1] * s
    bx, by = NEEDLE_B[0] * s, NEEDLE_B[1] * s
    cx, cy, r = DISC_C[0] * s, DISC_C[1] * s, DISC_R * s
    return (
        f'<svg width="{s}" height="{s}" viewBox="0 0 {s} {s}" '
        f'xmlns="http://www.w3.org/2000/svg">\n'
        f'  <polygon points="{pts}" fill="{body}"/>\n'
        f'  <line x1="{ax:.2f}" y1="{ay:.2f}" x2="{bx:.2f}" y2="{by:.2f}" '
        f'stroke="{needle}" stroke-width="{NEEDLE_W * s:.2f}" stroke-linecap="round"/>\n'
        f'  <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{disc}"/>\n'
        f'</svg>\n'
    )


# ── Marketing images ──────────────────────────────────────────────────


def get_font(size, bold=True):
    paths = [
        "/System/Library/Fonts/SFProText-Bold.otf" if bold else "/System/Library/Fonts/SFProText-Regular.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in paths:
        try:
            if p.endswith('Helvetica.ttc') and bold:
                return ImageFont.truetype(p, size, index=1)
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def soft_orbs(w, h, spots):
    """Blurry brand-color orbs on a transparent layer."""
    orb = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(orb)
    for (x, y, radius, color, peak) in spots:
        for rr in range(radius, 0, -3):
            a = int(peak * (rr / radius))
            od.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(*color, a))
    return orb


def tag_line(draw, x, y, font):
    """Tempo · sub-cent fees · access keys in brand colors."""
    parts = [
        ('Tempo', CORAL),
        ('  ·  ', (168, 160, 153)),
        ('sub-cent fees', LAVENDER),
        ('  ·  ', (168, 160, 153)),
        ('access keys', SAGE),
    ]
    for text, color in parts:
        draw.text((x, y), text, fill=(*color, 255), font=font)
        bb = draw.textbbox((x, y), text, font=font)
        x = bb[2]


def create_og(mark_512, title="Temporium", subtitle="Your wallet for the Tempo blockchain"):
    w, h = 1200, 630
    img = Image.new('RGBA', (w, h), (*CREAM, 255))
    img = Image.alpha_composite(
        img, soft_orbs(w, h, [(120, 90, 360, CORAL, 9), (1110, 560, 320, LAVENDER, 8)])
    )
    draw = ImageDraw.Draw(img)

    icon = mark_512.resize((190, 190), Image.LANCZOS)
    icon_x, icon_y = 150, (h - 190) // 2
    img.paste(icon, (icon_x, icon_y), icon)

    text_x = icon_x + 190 + 76
    title_y = icon_y + 22
    draw.text((text_x, title_y), title, fill=(*INK, 255), font=get_font(64, bold=True))
    draw.text(
        (text_x, title_y + 92),
        subtitle,
        fill=(*INK_2, 230),
        font=get_font(27, bold=False),
    )
    tag_line(draw, text_x, title_y + 148, get_font(21, bold=True))

    return img


def create_twitter_banner(mark_512):
    w, h = 1500, 500
    img = Image.new('RGBA', (w, h), (*CREAM, 255))
    img = Image.alpha_composite(
        img, soft_orbs(w, h, [(180, 60, 340, CORAL, 8), (1380, 460, 340, LAVENDER, 8)])
    )

    # Oversized ghost mark bleeding off the right edge for depth
    ghost = mark_512.resize((640, 640), Image.LANCZOS)
    alpha = ghost.split()[3].point(lambda a: int(a * 0.08))
    ghost.putalpha(alpha)
    img.paste(ghost, (w - 430, h - 480), ghost)

    draw = ImageDraw.Draw(img)
    icon = mark_512.resize((150, 150), Image.LANCZOS)
    icon_x, icon_y = 130, (h - 150) // 2 - 14
    img.paste(icon, (icon_x, icon_y), icon)

    text_x = icon_x + 150 + 56
    title_y = icon_y + 8
    draw.text((text_x, title_y), "Temporium", fill=(*INK, 255), font=get_font(58, bold=True))
    draw.text(
        (text_x, title_y + 82),
        "Your wallet for the Tempo blockchain",
        fill=(*INK_2, 230),
        font=get_font(25, bold=False),
    )
    tag_line(draw, text_x + 2, title_y + 130, get_font(20, bold=True))

    return img


def main():
    os.makedirs(OUTPUT, exist_ok=True)

    print("Temporium Logo Generator (metronome + coin)")
    print("=" * 40)

    # Retire assets from the old bolt-on-tile mark.
    for f in ['logo.png', 'logo-dark.png', 'logo-white.png', 'logo256.png']:
        p = os.path.join(OUTPUT, f)
        if os.path.exists(p):
            os.remove(p)
            print(f"  removed old: {f}")

    print("\n--- Rendering master mark ---")
    master = make_icon(512)

    with open(os.path.join(OUTPUT, 'logo.svg'), 'w') as f:
        f.write(logo_svg())
    print("  logo.svg")

    with open(os.path.join(OUTPUT, 'logo-dark.svg'), 'w') as f:
        f.write(logo_svg(body='#FDFBF8', needle='#F0B098', disc='#E07A5F'))
    with open(os.path.join(OUTPUT, 'logo-mono.svg'), 'w') as f:
        f.write(logo_svg(body='#2D3436', needle='#FDFBF8', disc='#2D3436'))
    print("  logo-dark.svg logo-mono.svg")

    for s in (32, 64, 128, 192, 256, 512):
        master.resize((s, s), Image.LANCZOS).save(os.path.join(OUTPUT, f'logo{s}.png'), 'PNG')
    print("  logo{32,64,128,192,256,512}.png")

    make_icon(512, body_color=CREAM).save(os.path.join(OUTPUT, 'logo-dark512.png'), 'PNG')
    print("  logo-dark512.png")

    for s in (16, 32):
        master.resize((s, s), Image.LANCZOS).save(os.path.join(OUTPUT, f'favicon-{s}x{s}.png'), 'PNG')
    ico_sizes = [master.resize((s, s), Image.LANCZOS) for s in (16, 32, 48)]
    ico_sizes[0].save(
        os.path.join(OUTPUT, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico_sizes[1:],
    )
    with open(os.path.join(OUTPUT, 'favicon.svg'), 'w') as f:
        f.write(logo_svg(32))
    print("  favicon-{16,32} favicon.ico favicon.svg")

    # Opaque cream tiles: iOS home screen + PWA manifest (also used as maskable,
    # so the mark is inset to stay inside the safe zone).
    make_icon(180, background=CREAM, pad=0.1).save(os.path.join(OUTPUT, 'apple-touch-icon.png'), 'PNG')
    for s in (192, 512):
        make_icon(s, background=CREAM, pad=0.14).save(os.path.join(OUTPUT, f'favicon-{s}x{s}.png'), 'PNG')
    print("  apple-touch-icon.png favicon-{192,512}")

    print("\n--- Generating marketing images ---")
    create_og(master).save(os.path.join(OUTPUT, 'og-image.png'), 'PNG')
    print("  og-image.png (1200x630)")
    create_twitter_banner(master).save(os.path.join(OUTPUT, 'twitter-banner.png'), 'PNG')
    print("  twitter-banner.png (1500x500)")

    print(f"\nDone! Assets in: {os.path.abspath(OUTPUT)}")


if __name__ == '__main__':
    main()
