from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
IMAGES_DIR = ROOT / "assets" / "images"

BRAND_A = (124, 92, 255)  # #7C5CFF
BRAND_B = (53, 230, 255)  # #35E6FF
INK = (16, 22, 47)  # #10162F
WHITE = (255, 255, 255)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(lerp(c1[0], c2[0], t)),
        int(lerp(c1[1], c2[1], t)),
        int(lerp(c1[2], c2[2], t)),
    )


def linear_gradient(size: int, c1: tuple[int, int, int], c2: tuple[int, int, int]) -> Image.Image:
    """Diagonal gradient."""
    img = Image.new("RGB", (size, size), c1)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = lerp_rgb(c1, c2, t)
    return img


def radial_light(size: int, strength: float = 0.55) -> Image.Image:
    """Soft radial light (white) as an alpha mask."""
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    # center a bit upper-left for "premium" lighting
    cx, cy = int(size * 0.34), int(size * 0.28)
    max_r = int(size * 0.85)
    for r in range(max_r, 0, -2):
        t = r / max_r
        # higher alpha near center
        a = int(255 * (1 - t) * strength)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=a)
    return m.filter(ImageFilter.GaussianBlur(radius=size * 0.04))


def draw_globe_and_check(
    size: int,
    *,
    stroke: int,
    color: tuple[int, int, int, int],
    scale: float = 0.72,
) -> Image.Image:
    """
    Returns an RGBA image containing a globe outline + meridians + checkmark.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Safe area
    r = int(size * 0.36 * scale)
    cx, cy = size // 2, size // 2

    # Globe circle
    bbox = (cx - r, cy - r, cx + r, cy + r)
    d.ellipse(bbox, outline=color, width=stroke)

    # Meridians/latitudes (subtle)
    # vertical meridian
    d.arc(bbox, start=70, end=110, fill=color, width=max(1, stroke - 2))
    d.arc(bbox, start=250, end=290, fill=color, width=max(1, stroke - 2))
    # horizontal latitude
    lat_r = int(r * 0.70)
    lat_bbox = (cx - r, cy - lat_r, cx + r, cy + lat_r)
    d.arc(lat_bbox, start=0, end=360, fill=color, width=max(1, stroke - 3))

    # Checkmark (approved)
    # points relative to circle
    p1 = (int(cx - r * 0.30), int(cy + r * 0.08))
    p2 = (int(cx - r * 0.08), int(cy + r * 0.30))
    p3 = (int(cx + r * 0.36), int(cy - r * 0.18))
    d.line([p1, p2, p3], fill=color, width=stroke + 2, joint="round")

    return img


def compose_app_icon(size: int = 1024) -> Image.Image:
    # Background gradient
    bg = linear_gradient(size, BRAND_A, BRAND_B).convert("RGBA")

    # Add soft light
    light = radial_light(size, strength=0.55)
    overlay = Image.new("RGBA", (size, size), WHITE + (0,))
    overlay.putalpha(light)
    bg = Image.alpha_composite(bg, overlay)

    # Foreground glyph in white
    glyph = draw_globe_and_check(size, stroke=max(10, size // 64), color=WHITE + (235,), scale=0.86)

    # Add a soft shadow behind glyph
    shadow = glyph.split()[-1].filter(ImageFilter.GaussianBlur(radius=size * 0.018))
    shadow_img = Image.new("RGBA", (size, size), INK + (0,))
    shadow_img.putalpha(shadow.point(lambda p: int(p * 0.22)))
    bg = Image.alpha_composite(bg, shadow_img)
    bg = Image.alpha_composite(bg, glyph)

    return bg


def compose_adaptive_foreground(size: int = 1024) -> Image.Image:
    # Foreground only (transparent), gradient stroke for a premium feel
    # Create gradient layer
    grad = linear_gradient(size, BRAND_A, BRAND_B).convert("RGBA")

    glyph = draw_globe_and_check(size, stroke=max(12, size // 58), color=WHITE + (255,), scale=0.78)
    # Use glyph alpha as mask to apply gradient inside strokes
    mask = glyph.split()[-1]
    grad_masked = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad_masked.paste(grad, (0, 0), mask)

    # Add subtle highlight, but only where the glyph exists
    highlight = Image.new("RGBA", (size, size), WHITE + (28,))
    highlight_masked = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    highlight_masked.paste(highlight, (0, 0), mask)

    out = Image.alpha_composite(grad_masked, highlight_masked)
    return out


def compose_splash_icon(size: int = 1024) -> Image.Image:
    # Transparent icon for white/light splash background
    fg = compose_adaptive_foreground(size)
    # Slightly larger for splash
    return fg


def compose_favicon(size: int = 48) -> Image.Image:
    # Simple: circle gradient + white check
    bg = linear_gradient(size, BRAND_A, BRAND_B).convert("RGBA")
    # circle mask
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((2, 2, size - 2, size - 2), fill=255)
    circ = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circ.paste(bg, (0, 0), mask)

    d2 = ImageDraw.Draw(circ)
    stroke = max(3, size // 10)
    # small check
    p1 = (int(size * 0.28), int(size * 0.52))
    p2 = (int(size * 0.42), int(size * 0.66))
    p3 = (int(size * 0.72), int(size * 0.34))
    d2.line([p1, p2, p3], fill=WHITE + (245,), width=stroke, joint="round")
    return circ


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    save(compose_app_icon(1024), IMAGES_DIR / "icon.png")
    save(compose_adaptive_foreground(1024), IMAGES_DIR / "adaptive-icon.png")
    save(compose_splash_icon(1024), IMAGES_DIR / "splash-icon.png")
    save(compose_favicon(48), IMAGES_DIR / "favicon.png")
    print("OK: regenerated logo assets in", IMAGES_DIR)


if __name__ == "__main__":
    main()

