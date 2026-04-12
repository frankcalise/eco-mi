#!/usr/bin/env python3
"""
Enhanced App Store Screenshot Composer

Uses a photorealistic device frame extracted from an existing
Gemini-enhanced screenshot. The frame template has a transparent
screen area so new app screenshots show through.
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont

# ── Canvas ──────────────────────────────────────────────────────────
CANVAS_W = 1290
CANVAS_H = 2796

# ── Device dimensions ───────────────────────────────────────────────
DEVICE_W = 1030
BEZEL = 15
SCREEN_W = DEVICE_W - 2 * BEZEL  # 1000
SCREEN_CORNER_R = 62

# ── Layout ──────────────────────────────────────────────────────────
DEVICE_Y = 720
DEVICE_X = (CANVAS_W - DEVICE_W) // 2  # 130
TEXT_TOP = 200

# ── Frame template positioning ──────────────────────────────────────
# The extracted frame was cropped with 60px padding around the device
FRAME_PAD = 60
FRAME_PASTE_X = DEVICE_X - FRAME_PAD  # 70
FRAME_PASTE_Y = DEVICE_Y - FRAME_PAD  # 660

# ── Typography ──────────────────────────────────────────────────────
VERB_SIZE_MAX = 256
VERB_SIZE_MIN = 150
DESC_SIZE = 124
VERB_DESC_GAP = 20
DESC_LINE_GAP = 24
MAX_TEXT_W = int(CANVAS_W * 0.92)
MAX_VERB_W = int(CANVAS_W * 0.92)

FONT_PATH = "/Library/Fonts/SF-Pro-Display-Black.otf"
FRAME_PATH = os.path.join(os.path.dirname(__file__), "assets", "device_frame_enhanced.png")


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def word_wrap(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_font(text, max_w, size_max, size_min):
    dummy = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    for size in range(size_max, size_min - 1, -4):
        font = ImageFont.truetype(FONT_PATH, size)
        bbox = dummy.textbbox((0, 0), text, font=font)
        if (bbox[2] - bbox[0]) <= max_w:
            return font
    return ImageFont.truetype(FONT_PATH, size_min)


def draw_centered(draw, y, text, font, max_w=None):
    lines = word_wrap(draw, text, font, max_w) if max_w else [text]
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        h = bbox[3] - bbox[1]
        draw.text((CANVAS_W // 2, y - bbox[1]), line, fill="white", font=font, anchor="mt")
        y += h + DESC_LINE_GAP
    return y


def compose(bg_hex, verb, desc, screenshot_path, output_path):
    bg = hex_to_rgb(bg_hex)

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (*bg, 255))
    draw = ImageDraw.Draw(canvas)

    # ── Text ────────────────────────────────────────────────────────
    verb_font = fit_font(verb.upper(), MAX_VERB_W, VERB_SIZE_MAX, VERB_SIZE_MIN)
    desc_font = ImageFont.truetype(FONT_PATH, DESC_SIZE)

    y = TEXT_TOP
    y = draw_centered(draw, y, verb.upper(), verb_font)
    y += VERB_DESC_GAP
    draw_centered(draw, y, desc.upper(), desc_font, max_w=MAX_TEXT_W)

    # ── Screenshot into screen area ─────────────────────────────────
    screen_x = DEVICE_X + BEZEL
    screen_y = DEVICE_Y + BEZEL

    shot = Image.open(screenshot_path).convert("RGBA")
    scale = SCREEN_W / shot.width
    sc_w = SCREEN_W
    sc_h = int(shot.height * scale)
    shot = shot.resize((sc_w, sc_h), Image.LANCZOS)

    screen_h = CANVAS_H - screen_y + 500

    # Screen mask (rounded rect)
    scr_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(scr_mask).rounded_rectangle(
        [screen_x, screen_y, screen_x + SCREEN_W, screen_y + screen_h],
        radius=SCREEN_CORNER_R,
        fill=255,
    )

    # Black screen bg + screenshot on top
    scr_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(scr_layer).rounded_rectangle(
        [screen_x, screen_y, screen_x + SCREEN_W, screen_y + screen_h],
        radius=SCREEN_CORNER_R,
        fill=(0, 0, 0, 255),
    )
    scr_layer.paste(shot, (screen_x, screen_y))
    scr_layer.putalpha(scr_mask)
    canvas = Image.alpha_composite(canvas, scr_layer)

    # ── Overlay extracted photorealistic frame ──────────────────────
    frame = Image.open(FRAME_PATH).convert("RGBA")
    frame_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    frame_layer.paste(frame, (FRAME_PASTE_X, FRAME_PASTE_Y))
    canvas = Image.alpha_composite(canvas, frame_layer)

    # ── Save ────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✓ {output_path} ({CANVAS_W}×{CANVAS_H})")


def main():
    p = argparse.ArgumentParser(description="Enhanced App Store screenshot composer")
    p.add_argument("--bg", required=True, help="Background hex colour")
    p.add_argument("--verb", required=True, help="Action verb")
    p.add_argument("--desc", required=True, help="Benefit descriptor")
    p.add_argument("--screenshot", required=True, help="Simulator screenshot path")
    p.add_argument("--output", required=True, help="Output file path")
    args = p.parse_args()
    compose(args.bg, args.verb, args.desc, args.screenshot, args.output)


if __name__ == "__main__":
    main()
