#!/usr/bin/env python3
"""
Batch renderer for Eco Mi App Store screenshots.

Renders all 7 headlines × 3 locales × N devices. Skips a (device, locale)
combination when raw inputs are missing (e.g. iPad frame or iPad simulator
captures not yet produced).

Usage:
  /tmp/ecomi-venv/bin/python scripts/build_screenshots.py
  /tmp/ecomi-venv/bin/python scripts/build_screenshots.py --device iphone-6.9
  /tmp/ecomi-venv/bin/python scripts/build_screenshots.py --device ipad-13
"""

import argparse
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)

sys.path.insert(0, SCRIPT_DIR)
from compose_enhanced import compose, DEVICE_PRESETS  # noqa: E402

BG = "#1a1a2e"

# (raw_basename, output_basename, verb, descriptor)
# raw_basename: filename stem in screenshots/raw/<lang>/<device-dir>/
#               EN has no suffix; ES/PT add -es / -pt (matches existing convention)
# output_basename: filename stem written to screenshots/final/<lang>/<device-dir>/
JOBS = {
    "en": [
        ("1-game-modes",    "01-play-five-modes",      "PLAY",       "FIVE GAME MODES"),
        ("2-game-play",     "02-challenge-memory",     "CHALLENGE",  "YOUR MEMORY"),
        ("3-high-score",    "03-beat-your-best",       "BEAT",       "YOUR BEST"),
        ("4-leaderboards",  "04-compete-leaderboard",  "COMPETE",    "ON THE LEADERBOARD"),
        ("5-customize",     "05-customize-style",      "CUSTOMIZE",  "YOUR STYLE"),
        ("6-progress",      "06-track-progress",       "TRACK",      "YOUR PROGRESS"),
        ("7-achievements",  "07-unlock-achievements",  "UNLOCK",     "ACHIEVEMENTS"),
    ],
    "es": [
        ("1-game-modes-es",    "01-juega-modos",          "JUEGA",       "CINCO MODOS DE JUEGO"),
        ("2-game-play-es",     "02-desafia-memoria",      "DESAFÍA",     "TU MEMORIA"),
        ("3-high-score-es",    "03-supera-record",        "SUPERA",      "TU RÉCORD"),
        ("4-leaderboards-es",  "04-compite-ranking",      "COMPITE",     "EN LA TABLA DE LÍDERES"),
        ("5-customize-es",     "05-personaliza-estilo",   "PERSONALIZA", "TU ESTILO"),
        ("6-progress-es",      "06-sigue-progreso",       "SIGUE",       "TU PROGRESO"),
        ("7-achievements-es",  "07-desbloquea-logros",    "DESBLOQUEA",  "LOGROS"),
    ],
    "pt": [
        ("1-game-modes-pt",    "01-jogue-modos",             "JOGUE",        "CINCO MODOS DE JOGO"),
        ("2-game-play-pt",     "02-desafie-memoria",         "DESAFIE",      "SUA MEMÓRIA"),
        ("3-high-score-pt",    "03-supere-recorde",          "SUPERE",       "SEU RECORDE"),
        ("4-leaderboards-pt",  "04-compita-ranking",         "COMPITA",      "NO RANKING"),
        ("5-customize-pt",     "05-personalize-estilo",      "PERSONALIZE",  "SEU ESTILO"),
        ("6-progress-pt",      "06-acompanhe-progresso",     "ACOMPANHE",    "SEU PROGRESSO"),
        ("7-achievements-pt",  "07-desbloqueie-conquistas",  "DESBLOQUEIE",  "CONQUISTAS"),
    ],
}

# Device preset → raw/final subdirectory name under each locale
DEVICE_DIR = {
    "iphone-6.9": "iphone",
    "ipad-13":    "ipad",
}


def run(devices):
    for device in devices:
        preset = DEVICE_PRESETS[device]
        dir_name = DEVICE_DIR[device]

        if not os.path.exists(preset["frame_path"]):
            print(f"⚠  {device}: frame missing at {preset['frame_path']} — skipping")
            continue

        for lang, jobs in JOBS.items():
            for src, out, verb, desc in jobs:
                shot = f"{REPO_ROOT}/screenshots/raw/{lang}/{dir_name}/{src}.png"
                outp = f"{REPO_ROOT}/screenshots/final/{lang}/{dir_name}/{out}.jpg"

                if not os.path.exists(shot):
                    print(f"⚠  missing raw: {shot} — skipping")
                    continue

                compose(BG, verb, desc, shot, outp, device=device)


def main():
    p = argparse.ArgumentParser(description="Batch renderer for Eco Mi App Store screenshots")
    p.add_argument(
        "--device",
        choices=list(DEVICE_PRESETS) + ["all"],
        default="all",
        help="Device preset to render (default: all)",
    )
    args = p.parse_args()
    devices = list(DEVICE_PRESETS) if args.device == "all" else [args.device]
    run(devices)


if __name__ == "__main__":
    main()
