"""
Format-agnostic CBC extraction from raw OCR text.

Extracts only the 14 standard parameters used by the Health Monitoring Hub API.
Does not depend on lab-specific layouts: uses line-based and full-text patterns,
plausibility checks, and unit hints so structured_data matches what Node's
normalizeCBCUnits() expects (test_name, observed_value, unit).
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional, Tuple

# Keys must match backend/routes/upload.js normalizeCBCUnits + STANDARD_CBC_PARAMS
CANON_KEYS = [
    "hemoglobin",
    "hematocrit",
    "rbc",
    "wbc",
    "platelets",
    "mcv",
    "mch",
    "mchc",
    "rdw",
    "neutrophils",
    "lymphocytes",
    "monocytes",
    "eosinophils",
    "basophils",
]

# Human-readable labels stored in test_name (substring match in Node).
# MCH = mean corpuscular hemoglobin (mass), typically pg — not the same as MCHC (concentration, g/dL).
DISPLAY_NAME = {
    "hemoglobin": "Hemoglobin",
    "hematocrit": "Hematocrit",
    "rbc": "RBC count",
    "wbc": "WBC count",
    "platelets": "Platelet count",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "rdw": "RDW",
    "neutrophils": "Neutrophils",
    "lymphocytes": "Lymphocytes",
    "monocytes": "Monocytes",
    "eosinophils": "Eosinophils",
    "basophils": "Basophils",
}

# Common OCR misreads on lab reports (substring / whole-line fixes).
# Use correct dictionary spellings in replacements so regexes and labels stay consistent.
_OCR_LABEL_FIXES: Tuple[Tuple[str, str], ...] = (
    (r"(?i)\bymphocytes\b", "Lymphocytes"),
    (r"(?i)\bymphocyte\b", "Lymphocyte"),
    (r"(?i)\beutrophils\b", "Neutrophils"),
    (r"(?i)\beutrophil\b", "Neutrophil"),
    (r"(?i)\bosinophils\b", "Eosinophils"),
    (r"(?i)\basophils\b", "Basophils"),
    (r"(?i)\bonocytes\b", "Monocytes"),
    (r"(?i)\blatelet\b", "Platelet"),
    (r"(?i)\bthrombocite\b", "Thrombocyte"),
    (r"(?i)\bthrombocytes\b", "Thrombocytes"),
    (r"(?i)\berythrocyte\b", "Erythrocyte"),
    (r"(?i)\berythrocytes\b", "Erythrocytes"),
    (r"(?i)\bleucocyte\b", "Leukocyte"),
    (r"(?i)\bleucocytes\b", "Leukocytes"),
    # Haem- vs hem-: normalize to US spelling used in DISPLAY_NAME / Node map
    (r"(?i)\bhaemoglobin\b", "Hemoglobin"),
    (r"(?i)\bhaematocrit\b", "Hematocrit"),
    # Printed / OCR typo: extra “r” (hematrocrit — wrong)
    (r"(?i)\bhematrocrit\b", "Hematocrit"),
    (r"(?i)\bhaematrocrit\b", "Hematocrit"),
)

# Canonical 5-part diff % — skip “(Abs)” rows so we don’t pick absolute 10³/µL values.
_DIFF_PERCENT_KEYS = frozenset(
    {"neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"}
)


def _ctx_has_x10_platelet_wbc(c: str) -> bool:
    """10³ / 10^3 / x10³ / OCR variants for platelet & WBC count scale."""
    return any(
        x in c
        for x in (
            "x10^3",
            "x10³",
            "×10³",
            "10^3",
            "10³",
            "103/",
            "10%/μ",
            "10%/u",
            "k/ul",
            "k/µl",
        )
    )


def _ctx_thou_per_mm3(c: str) -> bool:
    """Labs often report WBC/platelets as 'thou/mm3' or 'thou/mm³' (×10³/µL)."""
    cl = c.lower().replace(" ", "")
    if "thou" not in c.lower():
        return False
    return any(x in cl for x in ("thou/mm3", "thou/mm³", "thou/mm^3", "103/mm3", "10^3/mm"))


def _normalize_ocr_blob(text: str) -> str:
    if not text:
        return ""
    t = text
    t = t.replace("\r", "\n")
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


def _apply_ocr_typo_fixes(text: str, log: Optional[Callable[[str], None]] = None) -> str:
    """Fix common dropped-first-letter OCR errors on known CBC labels."""
    out = text
    for pattern, repl in _OCR_LABEL_FIXES:
        new = re.sub(pattern, repl, out)
        if new != out and log:
            log(f"    typo fix: applied {pattern!r} → {repl!r}")
        out = new
    return out


def _strip_reference_ranges(line: str) -> str:
    """Remove segments like 12-16 or 4.0 - 5.5 to reduce picking ref values as results."""
    s = line
    s = re.sub(
        r"\b\d+\.?\d*\s*[-–—]\s*\d+\.?\d*\b", " ", s, flags=re.IGNORECASE
    )
    return s


def _strip_lab_status_suffixes(line: str) -> str:
    """Remove trailing result flags (Low / High / Borderline) common on printed reports."""
    s = line
    s = re.sub(
        r"(?i)(?<=[\d.%])\s+(?:low|high|borderline|normal|abnormal|panic)\s*$",
        "",
        s,
    )
    return s.strip()


def _match_last_float(m: re.Match) -> Optional[float]:
    """Return the last numeric capture group (label groups precede the value)."""
    if not m or not m.lastindex:
        return None
    for i in range(m.lastindex, 0, -1):
        try:
            return float(m.group(i))
        except (ValueError, IndexError, TypeError):
            continue
    return None


def _plausible(key: str, val: float, ctx: str) -> bool:
    c = ctx.lower()

    if key == "hemoglobin":
        return 3.0 <= val <= 25.0
    if key == "hematocrit":
        return 10.0 <= val <= 70.0
    if key == "rbc":
        if val > 100:
            return 1e6 <= val <= 1e7
        return 1.0 <= val <= 8.5
    if key == "wbc":
        if _ctx_thou_per_mm3(c):
            return 0.3 <= val <= 80.0
        if _ctx_has_x10_platelet_wbc(c):
            return 0.5 <= val <= 50.0
        if 500 <= val <= 200000:
            return True
        return 1.5 <= val <= 100.0
    if key == "platelets":
        if "lakh" in c:
            return 0.05 <= val <= 9.0
        if _ctx_has_x10_platelet_wbc(c):
            # Avoid MPV reference row (e.g. 6.5 - 12.0) mis-read as platelet count.
            if val < 50.0 and any(
                x in c for x in ("mpv", "pdw", "pct", "mean platelet")
            ):
                return False
            return 5.0 <= val <= 999.0
        if any(x in c for x in ("x10^9", "x10e9", "10^9")):
            return 0.05 <= val <= 9.99
        # Platelet count in 10³/µL is often 150–450; avoid MPV (≈6–15 fL).
        if "platelet" in c and "mpv" not in c and "pdw" not in c and "pct" not in c:
            if 80.0 <= val <= 650.0:
                return True
        if "platelet" in c and _ctx_thou_per_mm3(c):
            return 15.0 <= val <= 500.0
        return 20.0 <= val <= 1200000.0
    if key == "mcv":
        return 50.0 <= val <= 125.0
    if key == "mch":
        return 14.0 <= val <= 42.0
    if key == "mchc":
        # g/dL typically; some forms show % with the same numeric range (not hematocrit %).
        return 26.0 <= val <= 40.0
    if key == "rdw":
        return 8.0 <= val <= 28.0
    if key in (
        "neutrophils",
        "lymphocytes",
        "monocytes",
        "eosinophils",
        "basophils",
    ):
        if "/ul" in c or "/µl" in c or "/cmm" in c or "absolute" in c:
            return 0.0 <= val <= 20000.0
        return 0.0 <= val <= 100.0
    return True


def _unit_for_context(key: str, ctx: str) -> str:
    c = ctx.lower()
    if key == "hemoglobin":
        return "g/dL" if any(u in c for u in ("g/dl", "g\\dl", "gm/dl", "g l")) else "g/dL"
    if key == "hematocrit":
        return "%"
    if key == "rbc":
        if "million" in c or "mill/" in c:
            return "million/µL"
        return ""
    if key == "wbc":
        if _ctx_thou_per_mm3(c):
            return "thou/mm³"
        if _ctx_has_x10_platelet_wbc(c):
            return "x10³/µL"
        if "k/ul" in c or "k/µl" in c:
            return "k/µL"
        if "/ul" in c or "/µl" in c or "/cmm" in c or "/cumm" in c:
            return "/µL"
        return ""
    if key == "platelets":
        if "lakh" in c:
            return "Lakhs/cmm"
        if any(x in c for x in ("x10^9", "x10e9", "10^9")):
            return "x10^9/L"
        if _ctx_thou_per_mm3(c):
            return "thou/mm³"
        if _ctx_has_x10_platelet_wbc(c):
            return "x10³/µL"
        if "/ul" in c or "/µl" in c or "/cmm" in c:
            return "/µL"
        return ""
    if key == "mcv":
        return "fL"
    if key == "mch":
        return "pg"
    if key == "mchc":
        return "g/dL"
    if key == "rdw":
        return "%"
    if key in (
        "neutrophils",
        "lymphocytes",
        "monocytes",
        "eosinophils",
        "basophils",
    ):
        if "/ul" in c or "/µl" in c or "/cmm" in c:
            return "/µL"
        if "%" in c:
            return "%"
        return "%"
    return ""


# Order matters where the same key appears twice (e.g. RDW-CV before RDW-SD before generic).
_LINE_REGEX: List[Tuple[str, re.Pattern[str]]] = [
    (
        "hemoglobin",
        re.compile(
            r"(?i)(hemoglobin|haemoglobin|hgb|\bh\.?b\.?\b)(?![^\n]*\bh\.?b\.?c)[^\d]{0,45}(\d+\.?\d*)"
        ),
    ),
    (
        "hematocrit",
        re.compile(
            r"(?i)(hematocrit|haematocrit|hematrocrit|haematrocrit|\bh\.?c\.?t\.?\b|\bpcv\b|packed\s*cell\s*vol(?:ume)?)[^\d]{0,45}(\d+\.?\d*)"
        ),
    ),
    (
        "rbc",
        re.compile(
            r"(?i)(\b(?:total\s*)?r\.?\s*b\.?\s*c\.?\s*(?:count)?\b|red\s*blood\s*cell|erythrocyte)(?![^\n]{0,8}distrib)[^\d]{0,45}(\d+\.?\d*)"
        ),
    ),
    (
        "wbc",
        re.compile(
            r"(?i)(?:total\s*count\s*\(\s*wbc\s*\)(?:\s*,\s*[^\d\n]{0,24})?|"
            r"total\s*(?:wbc|leukocyte|leucocyte)\s*count|total\s*leucocyte\s*count\s*\(\s*tlc\s*\)|"
            r"\b(?:tlc|w\.?\s*b\.?\s*c\.?)\b(?!\s*diff)|"
            r"white\s*blood\s*cell|leukocyte\s*count|leucocyte\s*count)[^\d]{0,75}(\d+\.?\d*)"
        ),
    ),
    (
        "platelets",
        re.compile(
            r"(?i)\b(\d{2,4})\s+(?:PLATELET\s+COUNT|platelet\s+count)\b"
        ),
    ),
    (
        "platelets",
        re.compile(
            r"(?i)(?:PLATELET\s+COUNT|platelet\s+count)\s+(\d+\.?\d*)(?!\s*[-–]\s*\d)"
        ),
    ),
    (
        "platelets",
        re.compile(
            r"(?i)(platelet(?:s)?(?:\s*count)?|\bplt\b|thrombocyte)[^\d]{0,35}(\d+\.?\d*)(?!\s*[-–]\s*\d)"
        ),
    ),
    ("mcv", re.compile(r"(?i)(?:^|[^\w])(\bm\.?\s*c\.?\s*v\.?\b|mean\s*corpuscular\s*volume|mean\s*cell\s*volume)[^\d]{0,35}(\d+\.?\d*)")),
    # MCHC before MCH so a line containing both abbreviations prefers concentration (pg vs g/dL differ).
    (
        "mchc",
        re.compile(
            r"(?i)(?:^|[^\w])(\bm\.?\s*c\.?\s*h\.?\s*c\.?\b|mean\s*corpuscular\s*h[ae]moglobin\s*conc(?:entration)?|mean\s*cell\s*h[ae]moglobin\s*conc(?:entration)?)[^\d]{0,35}(\d+\.?\d*)(?!\s*[-–]\s*\d)"
        ),
    ),
    (
        "mch",
        re.compile(
            r"(?i)(?:^|[^\w])(\bm\.?\s*c\.?\s*h\.?\b(?!\s*c)|mean\s*corpuscular\s*h[ae]moglobin\b(?!\s*conc(?:entration)?)|mean\s*cell\s*h[ae]moglobin\b(?!\s*conc(?:entration)?))[^\d]{0,35}(\d+\.?\d*)(?!\s*[-–]\s*\d)"
        ),
    ),
    # Prefer CV over SD; allow space after hyphen (e.g. "RDW- CV" on paper forms).
    # Reject picking ref-range endpoints (e.g. "35 - 56") as RDW.
    ("rdw", re.compile(r"(?i)rdw\s*[-–]\s*cv\b[^\d]{0,30}(\d+\.?\d*)(?!\s*[-–]\s*\d)")),
    ("rdw", re.compile(r"(?i)rdw\s*[-–]\s*sd\b[^\d]{0,30}(\d+\.?\d*)(?!\s*[-–]\s*\d)")),
    (
        "rdw",
        re.compile(
            r"(?i)(?:\b(?:r\.?\s*d\.?\s*w\.?|rdw)(?:\s*[-–]\s*(?:cv|sd))?\b|red\s*cell\s*distribution\s*width)[^\d]{0,30}(\d+\.?\d*)(?!\s*[-–]\s*\d)"
        ),
    ),
    (
        "neutrophils",
        re.compile(
            r"(?i)(?:segmented\s*)?neutrophils?\s*\(\s*%\s*\)[^\d]{0,45}(\d+\.?\d*)"
        ),
    ),
    (
        "neutrophils",
        re.compile(
            r"(?i)((?:segmented\s*)?neutrophil|polymorph)(?:s)?(?!\s*\(\s*abs)(?:\s*\(\s*%\s*\))?[^\d]{0,25}(\d+\.?\d*)"
        ),
    ),
    ("lymphocytes", re.compile(r"(?i)lymphocytes?\s*\(\s*%\s*\)[^\d]{0,45}(\d+\.?\d*)")),
    ("lymphocytes", re.compile(r"(?i)lymphocytes?(?!\s*\(\s*abs)[^\d]{0,30}(\d+\.?\d*)")),
    ("monocytes", re.compile(r"(?i)monocytes?\s*\(\s*%\s*\)[^\d]{0,45}(\d+\.?\d*)")),
    ("monocytes", re.compile(r"(?i)monocytes?(?!\s*\(\s*abs)[^\d]{0,25}(\d+\.?\d*)")),
    ("eosinophils", re.compile(r"(?i)eosinophils?\s*\(\s*%\s*\)[^\d]{0,45}(\d+\.?\d*)")),
    ("eosinophils", re.compile(r"(?i)eosinophils?(?!\s*\(\s*abs)[^\d]{0,25}(\d+\.?\d*)")),
    ("basophils", re.compile(r"(?i)basophils?\s*\(\s*%\s*\)[^\d]{0,45}(\d+\.?\d*)")),
    ("basophils", re.compile(r"(?i)basophils?(?!\s*\(\s*abs)[^\d]{0,25}(\d+\.?\d*)")),
]

_FULLTEXT_REGEX: List[Tuple[str, re.Pattern[str]]] = [
    (
        "hemoglobin",
        re.compile(
            r"(?i)(?:hemoglobin|haemoglobin|hgb|\bhb\b)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)",
            re.MULTILINE,
        ),
    ),
    (
        "hematocrit",
        re.compile(
            r"(?i)(?:hematocrit|haematocrit|hematrocrit|haematrocrit|\bhct\b|\bpcv\b|packed\s*cell\s*vol(?:ume)?)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)",
            re.MULTILINE,
        ),
    ),
    (
        "rbc",
        re.compile(
            r"(?i)(?:\brbc\b|r\.?\s*b\.?\s*c\.?|red\s*blood\s*cells?)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)",
            re.MULTILINE,
        ),
    ),
    (
        "wbc",
        re.compile(
            r"(?i)(?:total\s*count\s*\(\s*wbc\s*\)|total\s*(?:wbc|leukocyte|leucocyte)\s*count|"
            r"total\s*leucocyte\s*count\s*\(\s*tlc\s*\)|\bwbc\b|w\.?\s*b\.?\s*c\.?|\btlc\b|"
            r"total\s*leucocyte|total\s*wbc|leukocyte\s*count|leucocyte\s*count)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)",
            re.MULTILINE,
        ),
    ),
    (
        "platelets",
        re.compile(r"(?i)\b(\d{2,4})\s+platelet\s+count\b", re.MULTILINE),
    ),
    (
        "platelets",
        re.compile(
            r"(?i)platelet\s+count\s+(\d+\.?\d*)(?!\s*[-–]\s*\d)",
            re.MULTILINE,
        ),
    ),
    ("mcv", re.compile(r"(?i)(?:\bmcv\b|m\.?\s*c\.?\s*v\.?|mean\s*corpuscular\s*volume|mean\s*cell\s*volume)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)", re.MULTILINE)),
    (
        "mchc",
        re.compile(
            r"(?i)(?:\bmchc\b|m\.?\s*c\.?\s*h\.?\s*c\.?|mean\s*corpuscular\s*h[ae]moglobin\s*conc(?:entration)?|mean\s*cell\s*h[ae]moglobin\s*conc(?:entration)?)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)(?!\s*[-–]\s*\d)",
            re.MULTILINE,
        ),
    ),
    (
        "mch",
        re.compile(
            r"(?i)(?:\bmch\b(?!\s*c)|m\.?\s*c\.?\s*h\.?\b(?!\s*c)|mean\s*corpuscular\s*h[ae]moglobin\b(?!\s*conc(?:entration)?)|mean\s*cell\s*h[ae]moglobin\b(?!\s*conc(?:entration)?))[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)(?!\s*[-–]\s*\d)",
            re.MULTILINE,
        ),
    ),
    ("rdw", re.compile(r"(?i)rdw\s*[-–]\s*cv[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)(?!\s*[-–]\s*\d)", re.MULTILINE)),
    ("rdw", re.compile(r"(?i)rdw\s*[-–]\s*sd[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)(?!\s*[-–]\s*\d)", re.MULTILINE)),
    ("rdw", re.compile(r"(?i)(?:\brdw\b|r\.?\s*d\.?\s*w\.?)[\s:.\-–—]*[=]*[\s]*(\d+\.?\d*)(?!\s*[-–]\s*\d)", re.MULTILINE)),
    (
        "neutrophils",
        re.compile(
            r"(?i)(?:(?:segmented\s*)?neutrophils?|polymorphs?)[\s%:.\-–—]*[=]*[\s]*(\d+\.?\d*)",
            re.MULTILINE,
        ),
    ),
    (
        "lymphocytes",
        re.compile(r"(?i)lymphocytes?[\s%:.\-–—]*[=]*[\s]*(\d+\.?\d*)", re.MULTILINE),
    ),
    ("monocytes", re.compile(r"(?i)monocytes?[\s%:.\-–—]*[=]*[\s]*(\d+\.?\d*)", re.MULTILINE)),
    ("eosinophils", re.compile(r"(?i)eosinophils?[\s%:.\-–—]*[=]*[\s]*(\d+\.?\d*)", re.MULTILINE)),
    ("basophils", re.compile(r"(?i)basophils?[\s%:.\-–—]*[=]*[\s]*(\d+\.?\d*)", re.MULTILINE)),
]

# Many CBC forms OCR as columns: reference range, %, observed %, then "Neutrophils (%)".
# Geometry-sorted rec_texts interleave columns so "label then number" regexes mis-associate values.
# This block matches ref-range % VALUE Label(%) in one blob sweep and overwrites diff % keys.
_DIFF_REF_PCT_VAL_LABEL: List[Tuple[str, re.Pattern[str]]] = [
    (
        "neutrophils",
        re.compile(
            r"(?i)(?:\d+\.?\d*\s*[-–]\s*\d+\.?\d*|<\s*\d+\.?\d*)\s*%\s*(\d+\.?\d*)\s*(?:Segmented\s*)?Neutrophils\s*\(\s*%\s*\)"
        ),
    ),
    (
        "lymphocytes",
        re.compile(
            r"(?i)(?:\d+\.?\d*\s*[-–]\s*\d+\.?\d*|<\s*\d+\.?\d*)\s*%\s*(\d+\.?\d*)\s*Lymphocytes\s*\(\s*%\s*\)"
        ),
    ),
    (
        "monocytes",
        re.compile(
            r"(?i)(?:\d+\.?\d*\s*[-–]\s*\d+\.?\d*|<\s*\d+\.?\d*)\s*%\s*(\d+\.?\d*)\s*Monocytes\s*\(\s*%\s*\)"
        ),
    ),
    (
        "eosinophils",
        re.compile(
            r"(?i)(?:\d+\.?\d*\s*[-–]\s*\d+\.?\d*|<\s*\d+\.?\d*)\s*%\s*(\d+\.?\d*)\s*Eosinophils\s*\(\s*%\s*\)"
        ),
    ),
    (
        "basophils",
        re.compile(
            r"(?i)(?:\d+\.?\d*\s*[-–]\s*\d+\.?\d*|<\s*\d+\.?\d*)\s*%\s*(\d+\.?\d*)\s*Basophils\s*\(\s*%\s*\)"
        ),
    ),
]


def _choose_lines_from_fixed_texts(fixed_texts: List[str]) -> Tuple[List[str], str]:
    """Pick per-line OCR vs blob-split (same heuristic as legacy extract)."""
    j = _normalize_ocr_blob(" ".join(fixed_texts))
    split_blob = [
        ln.strip() for ln in re.split(r"[\n\r]+|(?<=\S)\s{2,}", j) if ln.strip()
    ]
    mega = max((len(x) for x in split_blob), default=0) if split_blob else 0
    if len(fixed_texts) >= 5 and (len(split_blob) <= 1 or mega > 800):
        return list(fixed_texts), f"rec_texts boxes, longest_joined={mega}"
    if split_blob:
        return split_blob, f"blob_split lines={len(split_blob)}"
    return list(fixed_texts), "rec_texts fallback"


def _try_diff_percent_ref_val_label_blob(
    blob: str,
    found: Dict[str, Tuple[float, str, str]],
    log: Optional[Callable[[str], None]],
) -> None:
    if not re.search(r"(?i)differential\s+wbc", blob):
        return
    for key, rx in _DIFF_REF_PCT_VAL_LABEL:
        m = rx.search(blob)
        if not m:
            continue
        val = float(m.group(1))
        ctx = m.group(0)
        if not _plausible(key, val, ctx):
            if log:
                log(f"    [reject diff-blob] {key} value={val} implausible | {ctx[:100]!r}")
            continue
        found[key] = (val, "%", ctx)
        if log:
            log(f"    [diff-blob] {key} = {val} %  |  ref%%→value→label  |  {ctx[:120]!r}")


def _try_line_regexes(
    lines: List[str],
    merged_lines: List[str],
    found: Dict[str, Tuple[float, str, str]],
    source: str,
    log: Optional[Callable[[str], None]],
) -> None:
    for bucket_name, bucket in (("lines", lines), ("line_pairs", merged_lines)):
        for line in bucket:
            scan = _strip_lab_status_suffixes(_strip_reference_ranges(line))
            if len(scan) < 2:
                continue
            ctx = line
            for key, rx in _LINE_REGEX:
                if key in found:
                    continue
                if key in _DIFF_PERCENT_KEYS and re.search(
                    r"\(\s*abs\b", ctx, re.IGNORECASE
                ):
                    continue
                m = rx.search(scan)
                if not m:
                    continue
                val = _match_last_float(m)
                if val is None:
                    continue
                if not _plausible(key, val, ctx):
                    if log:
                        log(
                            f"    [reject] {key} value={val} implausible | ctx={ctx[:120]}..."
                        )
                    continue
                unit = _unit_for_context(key, ctx)
                found[key] = (val, unit, ctx)
                if log:
                    log(
                        f"    [line:{source}/{bucket_name}] {key} = {val} {unit}  |  snippet: {ctx[:140]!r}"
                    )
        if len(found) == len(CANON_KEYS):
            break


def _try_fulltext(
    blob: str,
    existing: Dict[str, Tuple[float, str, str]],
    log: Optional[Callable[[str], None]],
) -> None:
    for key, rx in _FULLTEXT_REGEX:
        if key in existing:
            continue
        for m in rx.finditer(blob):
            val = _match_last_float(m)
            if val is None:
                continue
            span_start = max(0, m.start() - 80)
            span_end = min(len(blob), m.end() + 80)
            ctx = blob[span_start:span_end]
            if not _plausible(key, val, ctx):
                if log:
                    log(f"    [reject fulltext] {key} value={val} implausible")
                continue
            unit = _unit_for_context(key, ctx)
            existing[key] = (val, unit, ctx)
            if log:
                log(
                    f"    [fulltext] {key} = {val} {unit}  |  snippet: {ctx[:160]!r}"
                )
            break


def _merge_adjacent_lines(lines: List[str]) -> List[str]:
    """Forward + reverse pairs so value-before-label table cells still match."""
    out: List[str] = []
    for i, line in enumerate(lines):
        out.append(line)
        if i + 1 < len(lines):
            out.append(line + " " + lines[i + 1])
        if i > 0:
            out.append(lines[i - 1] + " " + line)
    return out


def extract_cbc_core_fields(
    rec_texts: List[str],
    all_text: Optional[str] = None,
    *,
    rec_texts_scan_order: Optional[List[str]] = None,
    verbose: bool = True,
    log: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """
    Returns structured haematology_report[] entries for the 14 CBC parameters when found.

    rec_texts_scan_order: detector/reading order before geometry sort (Paddle raw order).
      Multi-column tables often parse more reliably from this order than from
      top-left sorted boxes.

    verbose: print step-by-step extraction to log (default stdout via log or print).
    """
    log_fn = log or (print if verbose else lambda _m: None)

    def banner(title: str) -> None:
        log_fn("")
        log_fn("  " + "·" * 68)
        log_fn(f"  CBC PARSER  {title}")
        log_fn("  " + "·" * 68)

    texts = [str(t).strip() for t in rec_texts if t and str(t).strip()]
    banner("INPUT")
    log_fn(f"  rec_texts count: {len(texts)}")
    if texts:
        preview_n = min(25, len(texts))
        log_fn(f"  first {preview_n} raw lines (as received):")
        for i, t in enumerate(texts[:preview_n]):
            log_fn(f"    [{i:03d}] {t[:200]!r}")
        if len(texts) > preview_n:
            log_fn(f"    ... {len(texts) - preview_n} more line(s)")

    fixed_lines = [_apply_ocr_typo_fixes(t, log=None) for t in texts]
    if fixed_lines != texts:
        banner("OCR TYPO NORMALIZATION")
        for i, (a, b) in enumerate(zip(texts, fixed_lines)):
            if a != b:
                log_fn(f"    [{i:03d}] was: {a[:120]!r}")
                log_fn(f"          now: {b[:120]!r}")
        texts = fixed_lines
    else:
        log_fn("  (no typo normalizations applied)")

    blob_in = all_text if all_text else " ".join(texts)
    blob = _normalize_ocr_blob(blob_in)
    blob = _apply_ocr_typo_fixes(blob, log=None)

    scan_fixed: Optional[List[str]] = None
    if rec_texts_scan_order:
        scan_fixed = [
            _apply_ocr_typo_fixes(str(t).strip(), log=None)
            for t in rec_texts_scan_order
            if t and str(t).strip()
        ]

    banner("TEXT BLOB (for regex)")
    log_fn(f"  all_text length: {len(blob)} chars")
    log_fn(f"  preview (800 chars): {blob[:800]!r}{'...' if len(blob) > 800 else ''}")

    lines_geom, geom_reason = _choose_lines_from_fixed_texts(texts)
    log_fn(f"  line source (geometry-ordered input): {geom_reason}")

    banner("SPLIT LINES FOR MATCHING (geometry-ordered)")
    log_fn(f"  line count for PHASE 1a: {len(lines_geom)}")
    for i, ln in enumerate(lines_geom[:40]):
        log_fn(f"    [L{i:03d}] {ln[:180]!r}")
    if len(lines_geom) > 40:
        log_fn(f"    ... {len(lines_geom) - 40} more")

    merged_geom = _merge_adjacent_lines(lines_geom)

    found: Dict[str, Tuple[float, str, str]] = {}
    banner("PHASE 1a — line + line-pair regex (geometry-ordered)")
    _try_line_regexes(lines_geom, merged_geom, found, "geom", log_fn)

    if scan_fixed and scan_fixed != texts:
        lines_scan, scan_reason = _choose_lines_from_fixed_texts(scan_fixed)
        banner("PHASE 1b — line + line-pair regex (detector scan order)")
        log_fn(f"  line source: {scan_reason} | count={len(lines_scan)}")
        merged_scan = _merge_adjacent_lines(lines_scan)
        _try_line_regexes(lines_scan, merged_scan, found, "scan", log_fn)

    banner("PHASE 1c — differential % (ref % value Label) on full blob")
    _try_diff_percent_ref_val_label_blob(blob, found, log_fn)

    banner("PHASE 2 — full-text fallback (missing keys only)")
    _try_fulltext(blob, found, log_fn)

    banner("SUMMARY — 14 CBC keys")
    for key in CANON_KEYS:
        if key in found:
            val, unit, ctx = found[key]
            log_fn(f"    OK   {key:14s}  {val}  {unit!s:12s}  |  {ctx[:100]!r}")
        else:
            log_fn(f"    MISS {key:14s}  (no match)")

    haematology: List[Dict[str, str]] = []
    for key in CANON_KEYS:
        if key not in found:
            continue
        val, unit, _ = found[key]
        haematology.append(
            {
                "test_name": DISPLAY_NAME[key],
                "observed_value": str(float(val)),
                "unit": unit,
            }
        )

    banner("OUTPUT haematology_report rows")
    log_fn(f"  rows built: {len(haematology)}")
    for row in haematology:
        log_fn(f"    {row}")

    return {
        "patient_info": {},
        "laboratory_info": {},
        "haematology_report": haematology,
        "blood_indices": [],
        "morphology": {},
        "footer_info": {},
        "other_fields": {},
    }


def summarize_fourteen_fields(structured: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Map haematology_report rows to the 14 canonical CBC keys for logging / JSON export.
    """
    template = {
        k: {
            "found": False,
            "observed_value": None,
            "unit": "",
            "test_name": None,
        }
        for k in CANON_KEYS
    }
    if not structured:
        return template

    rows = structured.get("haematology_report") or []
    out: Dict[str, Dict[str, Any]] = {k: dict(v) for k, v in template.items()}
    matched: set = set()

    def assign(row: dict, key: str, tn: str) -> None:
        if key in matched:
            return
        out[key] = {
            "found": True,
            "observed_value": row.get("observed_value"),
            "unit": (row.get("unit") or ""),
            "test_name": tn,
        }
        matched.add(key)

    for row in rows:
        tn = (row.get("test_name") or "").strip()
        if not tn:
            continue
        tnl = tn.lower()
        for key in CANON_KEYS:
            if key in matched:
                continue
            if tnl == DISPLAY_NAME[key].lower():
                assign(row, key, tn)

    keys_by_len = sorted(CANON_KEYS, key=lambda k: len(DISPLAY_NAME[k]), reverse=True)
    for row in rows:
        tn = (row.get("test_name") or "").strip()
        if not tn:
            continue
        tnl = tn.lower()
        for key in keys_by_len:
            if key in matched:
                continue
            dl = DISPLAY_NAME[key].lower()
            # Only require the canonical label to appear inside the row name — never `tnl in dl`
            # (e.g. "mch" is a substring of "mchc" and would wrongly map to MCHC).
            if dl in tnl:
                assign(row, key, tn)
                break

    return out
