"""
Utility for filtering and normalising audio device names.

Logic:
- Always exclude: Windows aliases (Sound Mapper, Primary Sound Capture Driver),
  Bluetooth Hands-Free/mono profiles, and exact duplicate names.
- Exclude from microphone list: Stereo Mix / Wave Out Mix (those are loopback
  alternatives; the app already supports WASAPI loopback for system audio).
- In "basic" mode (advanced=False, the default), also exclude virtual/routing
  devices (VoiceMeeter, VB-Audio, NVIDIA RTX Voice, Steam Streaming …).
- In "advanced" mode (advanced=True), show everything that passed the hard
  filters above.

Name shortening:
- Strip common parenthetical suffixes that add no user value:
    "(Realtek HD Audio …)", "(USB Audio Device)", etc.
- Preserve meaningful parentheticals like "(2- USB Microphone)" → strip number prefix.
- Expose both `name` (short) and `full_name` (original) so the UI can show
  a tooltip with the real name.
"""

import re
from typing import List, Tuple

# ── Hard exclusions (always removed regardless of advanced flag) ─────────────
HARD_EXCLUDE_PATTERNS: List[str] = [
    r"microsoft sound mapper",
    r"primary sound capture driver",
    r"primary sound driver",
    # Bluetooth Hands-Free / HSP – mono, low-quality profile
    r"hands.?free",
    r"\bhsf\b",
    r"\bhsp\b",
]

# ── Soft exclusions (only in basic/default mode) ─────────────────────────────
SOFT_EXCLUDE_PATTERNS: List[str] = [
    # Virtual routing devices
    r"voicemeeter",
    r"vb.?audio",
    r"rtx voice",
    r"nvidia broadcast",
    r"steam streaming",
    r"cable",  # VB-Audio Cable, etc.
    r"virtual",
    # Stereo Mix / Wave Out – system-audio loopback via the old Stereo Mix path;
    # the app uses WASAPI loopback which is higher quality, so hide by default.
    r"stereo mix",
    r"wave out mix",
    r"what u hear",
    r"loopback",  # sounddevice sometimes exposes WASAPI loopback as a mic
]

# ── Parenthetical suffixes to strip from display name ────────────────────────
# These add technical detail the user doesn't need in the dropdown.
STRIP_SUFFIX_PATTERNS: List[re.Pattern] = [
    # "(Realtek HD Audio Mic input with SST)" → strip the whole parens
    re.compile(r"\s*\(realtek.*?\)\s*$", re.IGNORECASE),
    re.compile(r"\s*\(intel.*?\)\s*$", re.IGNORECASE),
    re.compile(r"\s*\(usb audio.*?\)\s*$", re.IGNORECASE),
    re.compile(r"\s*\(conexant.*?\)\s*$", re.IGNORECASE),
    # "(2- USB Microphone)" style prefix numbers inside parens → keep just name
    re.compile(r"\s*\(\d+[-–]\s*", re.IGNORECASE),  # partial, handled below
]

# Parens that start with a digit-dash, e.g.  "Mic (2- Blue Yeti)" → "Mic (Blue Yeti)"
_DIGIT_DASH_RE = re.compile(r"\((\d+[-–]\s*)(.+?)\)", re.IGNORECASE)


def _shorten_name(full_name: str) -> str:
    """Return a user-friendly shortened display name."""
    name = full_name.strip()

    # Remove digit-dash prefix inside parens: "(2- Blue Yeti)" → "(Blue Yeti)"
    name = _DIGIT_DASH_RE.sub(lambda m: f"({m.group(2).strip()})", name)

    for pattern in STRIP_SUFFIX_PATTERNS:
        name = pattern.sub("", name)

    # If the parens removal left a trailing open paren, close it gracefully
    name = re.sub(r"\($", "", name).strip()

    return name if name else full_name


def _is_hard_excluded(name_lower: str) -> bool:
    return any(re.search(p, name_lower) for p in HARD_EXCLUDE_PATTERNS)


def _is_soft_excluded(name_lower: str) -> bool:
    return any(re.search(p, name_lower) for p in SOFT_EXCLUDE_PATTERNS)


def filter_microphones(
    raw_devices: List[dict],
    default_input_idx: int,
    default_hostapi: int,
    advanced: bool = False,
) -> List[Tuple[int, str, str, dict]]:
    """
    Filter the raw sounddevice device list for microphone selection.

    Returns a list of (id, short_name, full_name, raw_dev) tuples.
    """
    seen_full_names: set = set()
    result = []

    for idx, dev in enumerate(raw_devices):
        full_name: str = dev["name"]
        name_lower = full_name.lower()

        # Must have input channels
        if dev["max_input_channels"] <= 0:
            continue

        # Prefer devices on the default host API (avoids duplicates across APIs)
        if dev["hostapi"] != default_hostapi:
            continue

        # Hard exclusions
        if _is_hard_excluded(name_lower):
            continue

        # Soft exclusions (skipped in advanced mode)
        if not advanced and _is_soft_excluded(name_lower):
            continue

        # De-duplicate by full name (some APIs list the same hardware twice)
        if full_name in seen_full_names:
            continue
        seen_full_names.add(full_name)

        short_name = _shorten_name(full_name)
        result.append((idx, short_name, full_name, dev))

    return result
