#!/usr/bin/env python3
"""
Enhanced App Store Screenshot Composer

Device-agnostic compositor that uses photorealistic device frame templates
with transparent screen areas so app screenshots show through. Supported
devices are declared in DEVICE_PRESETS — add a new preset to support a new
canvas/frame.
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = "/Library/Fonts/SF-Pro-Display-Black.otf"

DEVICE_PRESETS = {
    "iphone-6.9": {
        "canvas":          (1290, 2796),
        "device_w":        1030,
        "bezel":           15,
        "screen_corner_r": 62,
        "device_y":        720,
        "frame_path":      os.path.join(SCRIPT_DIR, "assets", "device_frame_enhanced.png"),
        "frame_pad":       60,
        "text_top":        200,
        "verb_size_max":   256,
        "verb_size_min":   150,
        "desc_size":       124,
        "verb_desc_gap":   20,
        "desc_line_gap":   24,
        "max_text_ratio":  0.92,
        "max_verb_ratio":  0.92,
    },
    "ipad-13": {
        # iPad frame PNG (2316x3016) is exported at 2x native pixel density,
        # with a 2062x2744 screen hole. Scaled to ~0.72 so the device occupies
        # ~80% of canvas width and leaves room for headline text above.
        "canvas":          (2064, 2752),
        "device_w":        1617,   # 2245 * 0.72 — device body (opaque) after scale
        "bezel":           66,     # ~91 * 0.72 — bezel thickness after scale
        "screen_corner_r": 40,     # ~55 * 0.72 — screen corner radius after scale
        "device_y":        600,    # vertical position of device body top on canvas
        "frame_path":      os.path.join(SCRIPT_DIR, "assets", "device_frame_ipad.png"),
        "frame_scale":     0.72,   # apply to the frame PNG before pasting
        "frame_pad_x":     24,     # ~33 * 0.72 — left shadow margin
        "frame_pad_y":     22,     # ~30 * 0.72 — top shadow margin
        "text_top":        180,
        "verb_size_max":   288,
        "verb_size_min":   180,
        "desc_size":       140,
        "verb_desc_gap":   28,
        "desc_line_gap":   32,
        "max_text_ratio":  0.92,
        "max_verb_ratio":  0.92,
    },
}


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


def draw_centered(draw, canvas_w, y, text, font, desc_line_gap, max_w=None):
    lines = word_wrap(draw, text, font, max_w) if max_w else [text]
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        h = bbox[3] - bbox[1]
        draw.text((canvas_w // 2, y - bbox[1]), line, fill="white", font=font, anchor="mt")
        y += h + desc_line_gap
    return y


def compose(bg_hex, verb, desc, screenshot_path, output_path, device="iphone-6.9"):
    if device not in DEVICE_PRESETS:
        raise ValueError(f"Unknown device '{device}'. Known: {list(DEVICE_PRESETS)}")
    p = DEVICE_PRESETS[device]

    canvas_w, canvas_h = p["canvas"]
    device_w = p["device_w"]
    bezel = p["bezel"]
    screen_w = device_w - 2 * bezel
    screen_corner_r = p["screen_corner_r"]
    device_y = p["device_y"]
    device_x = (canvas_w - device_w) // 2
    frame_pad_x = p.get("frame_pad_x", p.get("frame_pad", 0))
    frame_pad_y = p.get("frame_pad_y", p.get("frame_pad", 0))
    frame_paste_x = device_x - frame_pad_x
    frame_paste_y = device_y - frame_pad_y
    text_top = p["text_top"]
    verb_desc_gap = p["verb_desc_gap"]
    desc_line_gap = p["desc_line_gap"]
    max_text_w = int(canvas_w * p["max_text_ratio"])
    max_verb_w = int(canvas_w * p["max_verb_ratio"])

    bg = hex_to_rgb(bg_hex)

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (*bg, 255))
    draw = ImageDraw.Draw(canvas)

    # ── Text ────────────────────────────────────────────────────────
    verb_font = fit_font(verb.upper(), max_verb_w, p["verb_size_max"], p["verb_size_min"])
    desc_font = ImageFont.truetype(FONT_PATH, p["desc_size"])

    y = text_top
    y = draw_centered(draw, canvas_w, y, verb.upper(), verb_font, desc_line_gap)
    y += verb_desc_gap
    draw_centered(draw, canvas_w, y, desc.upper(), desc_font, desc_line_gap, max_w=max_text_w)

    # ── Screenshot into screen area ─────────────────────────────────
    screen_x = device_x + bezel
    screen_y = device_y + bezel

    shot = Image.open(screenshot_path).convert("RGBA")
    scale = screen_w / shot.width
    sc_w = screen_w
    sc_h = int(shot.height * scale)
    shot = shot.resize((sc_w, sc_h), Image.LANCZOS)

    screen_h = canvas_h - screen_y + 500

    scr_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(scr_mask).rounded_rectangle(
        [screen_x, screen_y, screen_x + screen_w, screen_y + screen_h],
        radius=screen_corner_r,
        fill=255,
    )

    scr_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(scr_layer).rounded_rectangle(
        [screen_x, screen_y, screen_x + screen_w, screen_y + screen_h],
        radius=screen_corner_r,
        fill=(0, 0, 0, 255),
    )
    scr_layer.paste(shot, (screen_x, screen_y))
    scr_layer.putalpha(scr_mask)
    canvas = Image.alpha_composite(canvas, scr_layer)

    # ── Overlay photorealistic frame ────────────────────────────────
    frame = Image.open(p["frame_path"]).convert("RGBA")
    frame_scale = p.get("frame_scale", 1.0)
    if frame_scale != 1.0:
        frame = frame.resize(
            (int(frame.width * frame_scale), int(frame.height * frame_scale)),
            Image.LANCZOS,
        )
    frame_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    frame_layer.paste(frame, (frame_paste_x, frame_paste_y))
    canvas = Image.alpha_composite(canvas, frame_layer)

    # ── Save ────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    canvas.convert("RGB").save(output_path, "JPEG", quality=95)
    print(f"✓ {output_path} ({canvas_w}×{canvas_h})")


def main():
    p = argparse.ArgumentParser(description="Enhanced App Store screenshot composer")
    p.add_argument("--bg", required=True, help="Background hex colour")
    p.add_argument("--verb", required=True, help="Action verb")
    p.add_argument("--desc", required=True, help="Benefit descriptor")
    p.add_argument("--screenshot", required=True, help="Simulator screenshot path")
    p.add_argument("--output", required=True, help="Output file path")
    p.add_argument(
        "--device",
        default="iphone-6.9",
        choices=list(DEVICE_PRESETS),
        help="Device preset (default: iphone-6.9)",
    )
    args = p.parse_args()
    compose(args.bg, args.verb, args.desc, args.screenshot, args.output, args.device)


if __name__ == "__main__":
    main()
