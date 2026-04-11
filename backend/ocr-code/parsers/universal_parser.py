"""
Universal parser for blood reports that can handle any format.
Uses predefined common fields and intelligent pattern matching.
"""

import re
from typing import List, Dict, Any, Optional


# Predefined common fields for blood reports
COMMON_PATIENT_FIELDS = {
    'patient_id': ['patient id', 'patient no', 'lab no', 'result no', 'phcr', 'booking no'],
    'patient_name': ['name', 'patient name', 'user'],
    'age': ['age'],
    'gender': ['gender', 'sex'],
    'age_gender': ['age/gender', 'age/sex'],
    'collection_date': ['collection date', 'sample collected', 'received date'],
    'report_date': ['report date', 'reporting date', 'results saved', 'release date'],
    'referring_doctor': ['referred by', 'referring doctor', 'consultant', 'dr.'],
    'phone': ['phone', 'mobile', 'phone no'],
    'specimen': ['specimen'],
    'ward_bed': ['ward', 'bed'],
    'report_id': ['report id'],
    'passport_no': ['passport no'],
}

COMMON_LAB_FIELDS = {
    'name': ['laboratory', 'lab', 'diagnostic', 'pathology', 'medical', 'foundation', 'clinic', 'centre'],
    'address': ['address'],
    'phone': ['phone', 'tel', 'telephone'],
    'email': ['email', '@'],
    'website': ['www', 'http', 'https'],
    'phcr_number': ['phcr'],
}

COMMON_TEST_NAMES = {
    # Haematology tests
    'haemoglobin': ['haemoglobin', 'hemoglobin', 'hb', 'hgb'],
    'wbc': [
        'wbc', 'w.b.c', 'w.b.c.', 'white blood cell', 'white blood cells',
        'total leucocyte count', 'total leukocyte count', 'total w.b.c.', 'total wbc',
        'total wbc count', 'wbc count', 'leucocyte count', 'leukocyte count', 'tlc',
        'w.b.c count',
    ],
    'rbc': [
        'rbc', 'r.b.c', 'r.b.c.', 'red blood cell', 'red blood cells', 'erythrocyte',
        'erythrocytes', 'rbc count', 'r.b.c count', 'total rbc', 'total rbc count',
    ],
    'platelet': ['platelet', 'platelets', 'platelet count', 'plt', 'thrombocyte', 'thrombocytes'],
    'neutrophils': ['neutrophils', 'polymorphs', 'neutrophil'],
    'lymphocytes': ['lymphocytes', 'lymphocyte'],
    'eosinophils': ['eosinophils', 'eosinophil'],
    'monocytes': ['monocytes', 'monocyte'],
    'basophils': ['basophils', 'basophil'],
    'absolute_neutrophils': ['absolute neutrophil', 'absolute neutrophils'],
    'absolute_lymphocytes': ['absolute lymphocyte', 'absolute lymphocytes'],
    'absolute_eosinophils': ['absolute eosinophil', 'absolute eosinophils'],
    'absolute_monocytes': ['absolute monocyte', 'absolute monocytes'],
    'absolute_basophils': ['absolute basophil', 'absolute basophils'],
    
    # Blood indices
    'mcv': [
        'mcv', 'm.c.v', 'm.c.v.', 'mean cell volume', 'mean corpuscular volume',
    ],
    'mch': [
        'mch', 'm.c.h', 'm.c.h.', 'mean cell hemoglobin', 'mean corpuscular hemoglobin',
    ],
    'mchc': [
        'mchc', 'm.c.h.c', 'm.c.h.c.', 'mean cell hb conc', 'mean cell hemoglobin concentration',
        'mean corpuscular hemoglobin concentration',
    ],
    'hct': [
        'hct', 'h.c.t', 'h.c.t.', 'hematocrit', 'haematocrit', 'pcv', 'packed cell volume',
    ],
    'rdw': ['rdw', 'r.d.w', 'r.d.w.', 'rdw-cv', 'rdw-sd', 'red cell distribution width'],
    'mpv': ['mpv', 'm.p.v.', 'mean platelet volume'],
    'pct': ['pct', 'plateletcrit'],
    'pdw': ['pdw'],
}

COMMON_MORPHOLOGY_FIELDS = {
    'rbc_morphology': ['rbc morphology', 'red cell morphology'],
    'platelets_on_smear': ['platelets on smear', 'platelet on smear'],
    'wbc_morphology': ['wbc morphology', 'white cell morphology'],
}

COMMON_FOOTER_FIELDS = {
    'doctor_name': ['dr.', 'doctor'],
    'qualification': ['mbbs', 'md', 'dcp', 'phd'],
    'registration': ['registration', 'reg no', 'reg. no'],
    'lab_technician': ['lab technician', 'technician'],
    'printed_by': ['printed by'],
    'printed_on': ['printed on'],
}


def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    if not text:
        return ""
    return text.lower().strip()


def matches_field(text: str, field_keywords: List[str]) -> bool:
    """Check if text matches any of the field keywords."""
    normalized = normalize_text(text)
    for keyword in field_keywords:
        if not keyword:
            continue
        # Punctuation / symbols (e.g. @) — substring is fine
        if len(keyword) == 1 or not keyword[0].isalnum():
            if keyword in normalized:
                return True
            continue
        # Short keywords: use word boundaries so "tel" does not match inside "platelets"
        if len(keyword) <= 3:
            if re.search(r'\b' + re.escape(keyword) + r'\b', normalized):
                return True
        elif keyword in normalized:
            return True
    return False


def extract_value_after_colon(texts: List[str], start_idx: int, max_lookahead: int = 3) -> Optional[str]:
    """Extract value after a colon or in next few items."""
    # Check current item for colon
    if start_idx < len(texts):
        current = texts[start_idx]
        if ':' in current:
            parts = current.split(':', 1)
            if len(parts) > 1 and parts[1].strip():
                return parts[1].strip()
    
    # Look ahead
    for i in range(1, min(max_lookahead + 1, len(texts) - start_idx)):
        if start_idx + i < len(texts):
            value = texts[start_idx + i].strip()
            # Skip empty, colons only, or common separators
            if value and value not in [':', '.', '"', "'"] and not value.startswith(':'):
                return value
    return None


def is_test_name(text: str) -> bool:
    """Check if text looks like a test name."""
    normalized = normalize_text(text)
    # Check against common test names
    for test_keywords in COMMON_TEST_NAMES.values():
        for keyword in test_keywords:
            if keyword in normalized:
                return True
    return False


def is_number(text: str) -> bool:
    """Check if text is a number (with optional decimal)."""
    if not text:
        return False
    # Remove common units and check
    cleaned = normalize_text(text)
    # Common unit spellings seen in reports
    cleaned = (
        cleaned.replace('gm/dl', '')
        .replace('g/dl', '')
        .replace('g/l', '')
        .replace('%', '')
        .replace('fl', '')
        .replace('pg', '')
        .strip()
    )
    # Drop scientific / count style unit tails if present
    cleaned = re.sub(r'x\s*10(\^?\d+|e\d+)\s*/\s*l', '', cleaned)
    cleaned = cleaned.replace('/ul', '').replace('/µl', '').replace('/cumm', '').replace('/l', '').strip()
    try:
        float(cleaned)
        return True
    except ValueError:
        return False


def is_reference_range(text: str) -> bool:
    """Check if text looks like a reference range."""
    if not text:
        return False
    # Pattern: number-number or number - number
    pattern = r'\d+[\s-]+\d+'
    if re.search(pattern, text):
        return True
    # Pattern: number-number-number (like 13-17)
    if '-' in text and any(c.isdigit() for c in text):
        return True
    return False


def is_unit(text: str) -> bool:
    """Check if text looks like a unit."""
    if not text:
        return False
    # NEUTROPHILS%, LYMPHOCYTES%, etc. contain '%' but are test names, not units
    if is_test_name(text):
        return False
    normalized = normalize_text(text)
    units = [
        'g/dl', 'gm/dl', 'g/l', '%', 'fl', 'pg',
        '/ul', '/µl', '/cumm', '/l',
        'million/ul', 'cells/ul', 'cmm', 'lakhs', 'mill/cumm',
        'x103', 'x10^3'
    ]
    if any(unit in normalized for unit in units):
        return True
    # x10^9/L, x 10^12/L, x10e9/L, etc.
    if re.search(r'x\s*10(\^?\d+|e\d+)\s*/\s*l', normalized):
        return True
    return False


def split_value_and_unit(token: str) -> Optional[tuple]:
    """
    If token looks like '<number><unit>' or '<number> <unit>', return (value, unit).
    Examples: '17.5 gm/dL', '51%', '5.8 x 10^12/L', '169 x10^9/L', '5.4 x 10e9/L'
    """
    if not token:
        return None
    t = token.strip()
    if is_reference_range(t):
        return None
    # Don't treat pure test names as value+unit
    if is_test_name(t) and not is_number(t):
        return None

    # Find first numeric value
    m = re.search(r'(\d+\.?\d*)', t)
    if not m:
        return None
    value = m.group(1)
    unit_part = t[m.end():].strip()
    if not unit_part:
        return None
    # If unit_part is just another number, skip
    if is_number(unit_part) and not is_unit(unit_part):
        return None
    # Accept if unit_part looks like a unit
    if is_unit(unit_part) or is_unit(t):
        # Prefer compact unit extraction for % stuck to number
        if '%' in t:
            return value, '%'
        return value, unit_part
    return None


def _numeric_token_value(text: str) -> Optional[float]:
    """Parse a leading number from a token (handles '07', '49%', etc.)."""
    if not text:
        return None
    m = re.search(r'(\d+\.?\d*)', text.replace(',', '.'))
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def is_methodology_noise(text: str) -> bool:
    """OCR sub-lines under test names (Calculated, Electrical Impedance, etc.)."""
    if not text:
        return False
    n = normalize_text(text)
    if len(n) > 100:
        return False
    fragments = (
        'calculated',
        'electrical impedance',
        'impedance',
        'vcs',
        'immunoturbidimetry',
        'fully automated',
        'cell counter',
        'flow cytometry',
        'photometry',
    )
    return any(f in n for f in fragments)


def is_wbc_percent_differential_test(test_name: str) -> bool:
    """
    True for 5-part WBC differential % lines (not absolute counts).
    These rows often appear after PLATELETS; OCR can leave the previous row's
    ref-range bound (e.g. 400 from 150-400) as a stray number before the real %.
    """
    if not test_name or ':' in test_name:
        return False
    n = normalize_text(test_name)
    if 'absolute' in n:
        return False
    for key in ('neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'):
        for kw in COMMON_TEST_NAMES[key]:
            if kw in n:
                return True
    return False


def _parse_wbc_percent_differential_row(
    texts: List[str], start_idx: int
) -> Optional[tuple]:
    """
    Parse NEUTROPHILS% / LYMPHOCYTES% style rows: collect tokens until reference range
    or next test, then read result from '%' neighbour or last plausible 0–100 value.
    Returns (result_dict, next_index) or None.
    """
    test_name = texts[start_idx].strip()
    result: Dict[str, Any] = {
        'test_name': test_name,
        'observed_value': '',
        'unit': '%',
        'reference_range': ''
    }
    i = start_idx + 1
    tokens_before_ref: List[str] = []
    seen_ref = False

    while i < min(start_idx + 22, len(texts)):
        t = texts[i].strip()
        if not t or t in [':', '.', '"', "'"]:
            i += 1
            continue
        if is_methodology_noise(t):
            i += 1
            continue
        if is_reference_range(t):
            result['reference_range'] = t
            seen_ref = True
            i += 1
            break
        # Next lab row started — do not consume its test name
        if is_test_name(t) and i > start_idx + 1:
            break
        tokens_before_ref.append(t)
        i += 1

    observed = ''
    for tok in tokens_before_ref:
        if '%' in tok:
            compact = re.sub(r'\s+', '', tok)
            m = re.search(r'(\d+\.?\d*)\s*%', compact)
            if m:
                observed = m.group(1).lstrip('0') or '0'
                if observed.startswith('.'):
                    observed = '0' + observed
                break
    if not observed:
        for j, tok in enumerate(tokens_before_ref):
            if tok.strip() == '%' and j > 0:
                prev = tokens_before_ref[j - 1].strip()
                if is_number(prev) and not is_reference_range(prev):
                    observed = prev.lstrip('0') or prev
                    break

    if not observed:
        plausible: List[str] = []
        for tok in tokens_before_ref:
            if is_reference_range(tok):
                continue
            v = _numeric_token_value(tok)
            if v is None:
                continue
            if 0 <= v <= 100 and is_number(tok):
                plausible.append(tok)
        if plausible:
            pick = plausible[-1]
            pv = _numeric_token_value(pick)
            observed = str(int(pv)) if pv is not None and pv == int(pv) else (str(pv) if pv is not None else pick)

    if not observed:
        return None

    result['observed_value'] = observed
    return result, i


def parse_test_result(texts: List[str], start_idx: int) -> Optional[Dict[str, Any]]:
    """
    Parse a test result starting from start_idx.
    Returns dict with test_name, observed_value, unit, reference_range or None.
    """
    if start_idx >= len(texts):
        return None
    
    test_name = texts[start_idx].strip()
    if not test_name or test_name.upper() in [
        'TEST', 'TEST(S)', 'TEST DESCRIPTION',
        'RESULT', 'RESULT(S)',
        'REF. RANGE', 'REF. RANGE(S)',
        'UNIT', 'UNIT(S)',
        'TEST NAME', 'OBSERVED VALUE', 'OBSERVED VALUE(S)', 'REFERENCE RANGE', 'REFERENCE RANGE(S)',
        'REFERENCE VALUE', 'REFERENCE VALUE(S)',
        'INVESTIGATION', 'UNITS', 'BIOLOGICAL REFERENCE INTERVAL'
    ]:
        return None
    
    # Skip if it's a section header
    section_headers = [
        'HAEMATOLOGY', 'BLOOD INDICES', 'DIFFERENTIAL COUNT', 'DIFFERENTIAL WBC COUNT',
        'DIFFERENTIAL LEUCOCYTE COUNT', 'DIFFERENTIAL LEUKOCYTE COUNT',
        'PLATELET COUNT', 'RBC INDICES', 'PLATELETS INDICES',
        'ABSOLUTE LEUCOCYTE COUNT', 'COMPLETE BLOOD COUNT',
        'COMPLETE BLOOD PICTURE', 'CP (COMPLETE BLOOD PICTURE)',
    ]
    if any(header in test_name.upper() for header in section_headers):
        return None
    
    # WBC differential % rows: read tokens up to ref range / next test so we do not bind
    # a stray prior-row bound (e.g. 400 from platelets 150-400) as the result.
    if is_wbc_percent_differential_test(test_name):
        spec = _parse_wbc_percent_differential_row(texts, start_idx)
        if spec:
            row, next_i = spec
            row['_next_index'] = next_i
            return row
    
    result = {
        'test_name': test_name,
        'observed_value': '',
        'unit': '',
        'reference_range': ''
    }
    
    # Look ahead to find value, unit, and range
    i = start_idx + 1
    found_value = False
    found_unit = False
    found_range = False
    
    # Check if current item has colon with value
    if ':' in test_name:
        parts = test_name.split(':', 1)
        if len(parts) > 1:
            test_name = parts[0].strip()
            potential_value = parts[1].strip()
            if potential_value and (is_number(potential_value) or potential_value):
                result['test_name'] = test_name
                result['observed_value'] = potential_value
                found_value = True
    
    result['test_name'] = test_name
    
    # Look ahead across methodology / status tokens (Calculated, Normal, etc.)
    lookahead_end = min(start_idx + 22, len(texts))
    while i < lookahead_end and (not found_value or not found_unit or not found_range):
        current = texts[i].strip()
        
        if not current or current in [':', '.', '"', "'"]:
            i += 1
            continue

        if is_methodology_noise(current):
            i += 1
            continue

        if not found_value and normalize_text(current) == 'normal':
            i += 1
            continue

        # Handle combined value+unit tokens early (e.g., '17.5 gm/dL', '5.8 x 10^12/L', '51%')
        if not found_value:
            vu = split_value_and_unit(current)
            if vu:
                val_str, unit_str = vu
                result['observed_value'] = val_str
                found_value = True
                if not found_unit and unit_str:
                    result['unit'] = unit_str
                    found_unit = True
                i += 1
                continue
        
        # Check for value (number)
        if not found_value and is_number(current) and not is_reference_range(current):
            val_f = _numeric_token_value(current)
            tn = result.get('test_name', test_name)
            if (
                is_wbc_percent_differential_test(tn)
                and val_f is not None
                and val_f > 100
            ):
                i += 1
                continue
            result['observed_value'] = current
            found_value = True
            i += 1
            continue
        
        # Check for unit
        if not found_unit and is_unit(current):
            result['unit'] = current
            found_unit = True
            i += 1
            continue
        
        # Check for reference range
        if not found_range and is_reference_range(current):
            result['reference_range'] = current
            found_range = True
            i += 1
            continue
        
        # If we found value but next item might be value with colon
        if found_value and ':' in current:
            parts = current.split(':', 1)
            if len(parts) > 1 and parts[1].strip():
                # This might be another test, stop here
                break
        
        i += 1
    
    # Provide a reliable resume point for the outer loop.
    # This avoids misalignment when value+unit are in the same token.
    result['_next_index'] = i

    # Only return if we have at least test name and value (or a recognized test name)
    if result['test_name'] and (result['observed_value'] or is_test_name(result['test_name'])):
        return result
    
    return None


def _cbc_row_has_value(parsed_data: Dict[str, Any], tokens: List[str]) -> bool:
    """True if a row matching tokens already has a numeric observed_value."""
    for sec in ('haematology_report', 'blood_indices'):
        for row in parsed_data.get(sec) or []:
            tn = normalize_text(row.get('test_name') or '')
            if not any(t in tn for t in tokens):
                continue
            if 'mch' in tokens and 'mchc' in tn:
                continue
            ov = str(row.get('observed_value') or '').strip().lower()
            if not ov or ov == 'normal':
                continue
            if re.match(r'^[\d.]+', ov):
                return True
    return False


def _parse_float_safe(s: str) -> Optional[float]:
    try:
        return float(str(s).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def _cbc_row_value_plausible(
    parsed_data: Dict[str, Any],
    tokens: List[str],
    low: float,
    high: float,
    exclude_in_tn: Optional[List[str]] = None,
) -> bool:
    """True if matching row has numeric observed_value already in [low, high]."""
    skip_phrases = exclude_in_tn or []
    for sec in ('haematology_report', 'blood_indices'):
        for row in parsed_data.get(sec) or []:
            tn = normalize_text(row.get('test_name') or '')
            if any(p in tn for p in skip_phrases):
                continue
            if not any(t in tn for t in tokens):
                continue
            if 'mch' in tokens and 'mchc' in tn:
                continue
            ov = _parse_float_safe(str(row.get('observed_value') or '').strip())
            if ov is None:
                continue
            if low <= ov <= high:
                return True
    return False


def _fill_or_add_cbc_row(
    parsed_data: Dict[str, Any],
    section: str,
    display_name: str,
    tokens: List[str],
    value: str,
    unit: str = '',
    *,
    plausible: Optional[tuple] = None,
    exclude_in_tn: Optional[List[str]] = None,
) -> None:
    """
    Insert or update a CBC row. If plausible=(lo, hi) is set, an existing value
    outside that range is treated as a bad OCR capture and overwritten.
    """
    skip_phrases = exclude_in_tn or []
    target = parsed_data.setdefault(section, [])
    for row in target:
        tn = normalize_text(row.get('test_name') or '')
        if any(p in tn for p in skip_phrases):
            continue
        if not any(t in tn for t in tokens):
            continue
        if 'mch' in tokens and 'mchc' in tn:
            continue
        raw_ov = str(row.get('observed_value') or '').strip()
        ov = _parse_float_safe(raw_ov)
        if plausible is not None:
            lo, hi = plausible
            if ov is not None and lo <= ov <= hi and raw_ov.lower() != 'normal':
                return
        else:
            if raw_ov and re.match(r'^[\d.]+', raw_ov) and raw_ov.lower() != 'normal':
                return
        row['observed_value'] = value
        if unit:
            row['unit'] = unit
        return
    target.append({
        'test_name': display_name,
        'observed_value': value,
        'unit': unit,
        'reference_range': '',
    })


def _capture_followed_by_reference_dash(blob: str, m: re.Match) -> bool:
    """True if match is likely the left bound of 'X - Y' (reference column), not the result."""
    tail = blob[m.end() : m.end() + 24]
    return bool(re.match(r'^\s*-\s*\d', tail))


def _capture_is_rhs_of_dash_range(blob: str, group_start: int) -> bool:
    """True if the number starts right after 'A - ' (right-hand side of a ref band like 32.50 - 34.50)."""
    prefix = blob[:group_start].rstrip()
    return bool(re.search(r'\d(?:\.\d+)?\s*-\s*$', prefix))


def _find_capture_in_range(
    blob: str,
    pattern: str,
    lo: float,
    hi: float,
    *,
    skip_if_reference_dash: bool = False,
) -> Optional[str]:
    """
    Scan regex matches; return first capture in [lo, hi].
    If skip_if_reference_dash, ignore captures immediately followed by ' - <digit>' (ref ranges).
    """
    for m in re.finditer(pattern, blob, re.IGNORECASE):
        gs = m.start(1)
        if skip_if_reference_dash and _capture_followed_by_reference_dash(blob, m):
            continue
        if skip_if_reference_dash and _capture_is_rhs_of_dash_range(blob, gs):
            continue
        v = _parse_float_safe(m.group(1))
        if v is not None and lo <= v <= hi:
            return m.group(1)
    return None


def _last_plausible_number_after_label(
    blob: str,
    label_pattern: str,
    lo: float,
    hi: float,
) -> Optional[str]:
    """Like _first_plausible_number_after_label but keeps the last match (diff % after ref band)."""
    last: Optional[str] = None
    for lm in re.finditer(label_pattern, blob, re.IGNORECASE):
        window = blob[lm.end() : lm.end() + 300]
        for nm in re.finditer(r'(\d{1,2}(?:\.\d{1,2})?)\b', window):
            abs_start = lm.end() + nm.start(1)
            abs_end = lm.end() + nm.end()
            tail = blob[abs_end : abs_end + 22]
            if re.match(r'^\s*-\s*\d', tail):
                continue
            if _capture_is_rhs_of_dash_range(blob, abs_start):
                continue
            v = _parse_float_safe(nm.group(1))
            if v is not None and lo <= v <= hi:
                last = nm.group(1)
    return last


def _first_plausible_number_after_label(
    blob: str,
    label_pattern: str,
    lo: float,
    hi: float,
) -> Optional[str]:
    """
    After each label match, scan forward for numeric tokens in range [lo, hi].
    Skips values that start a reference span ('32.50 - 34.50').
    Picks the first plausible result (handles ref column before result column in OCR).
    """
    for lm in re.finditer(label_pattern, blob, re.IGNORECASE):
        window = blob[lm.end() : lm.end() + 300]
        for nm in re.finditer(r'(\d{1,2}(?:\.\d{1,2})?)\b', window):
            abs_start = lm.end() + nm.start(1)
            abs_end = lm.end() + nm.end()
            tail = blob[abs_end : abs_end + 22]
            if re.match(r'^\s*-\s*\d', tail):
                continue
            if _capture_is_rhs_of_dash_range(blob, abs_start):
                continue
            v = _parse_float_safe(nm.group(1))
            if v is not None and lo <= v <= hi:
                return nm.group(1)
    return None


def _find_wbc_absolute_count(blob: str) -> Optional[str]:
    """Resolve WBC in cells/µL from noisy OCR text (4–6 digits, optional split thousands)."""
    skip = True
    # Split thousands: "10 000", "10,000"
    for m in re.finditer(
        r'total\s*wbc\s*count\D{0,320}?(\d{1,2})[\s,]+(\d{3})\b',
        blob,
        re.IGNORECASE,
    ):
        if skip and _capture_followed_by_reference_dash(blob, m):
            continue
        try:
            whole = int(m.group(1)) * 1000 + int(m.group(2))
        except ValueError:
            continue
        if 2500 <= whole <= 100000:
            return str(whole)
    # All 4–6 digit groups after WBC labels (reference "4000 - 11000" may appear before result "10000").
    # Prefer "total wbc count" so generic "wbc count" does not pick platelet counts on some layouts.
    wbc_label_order = [
        r'total\s*wbc\s*count',
        r'\bwbc\s*count\b',
        r'tlc\b',
        r'leucocyte\s*count',
        r'leukocyte\s*count',
    ]
    for label_pat in wbc_label_order:
        for lm in re.finditer(label_pat, blob, re.IGNORECASE):
            window = blob[lm.end() : lm.end() + 360]
            for nm in re.finditer(r'(\d{4,6})\b', window):
                abs_start = lm.end() + nm.start(1)
                abs_end = lm.end() + nm.end()
                tail = blob[abs_end : abs_end + 22]
                if re.match(r'^\s*-\s*\d', tail):
                    continue
                if _capture_is_rhs_of_dash_range(blob, abs_start):
                    continue
                v = _parse_float_safe(nm.group(1))
                if v is not None and 2500 <= v <= 100000:
                    return nm.group(1)

    pats = [
        r'total\s*wbc\D{0,320}?(\d{5,6})\b',
        r'total\s*wbc\D{0,320}?(\d{4,6})(?=\s*normal\b)',
        r'(?:total\s*)?wbc\s*count\D{0,160}?(\d{4,6})\s*cumm',
    ]
    for pat in pats:
        v = _find_capture_in_range(blob, pat, 2500.0, 100000.0, skip_if_reference_dash=skip)
        if v:
            return v
    return None


def _enrich_cbc_from_fulltext(joined_text: str, parsed_data: Dict[str, Any]) -> None:
    """
    Second pass: OCR often returns table cells out of strict reading order.
    Scan flattened text with tolerant regex to recover common CBC lines.
    """
    if not joined_text or len(joined_text) < 40:
        return
    blob = re.sub(r'\s+', ' ', joined_text.lower())

    specs = [
        ('haematology_report', 'Hemoglobin', ['hemoglobin', 'hb', 'hgb'],
         r'hemoglobin(?:\s*\([^)]*\))?[^0-9]{0,120}(\d{1,2}\.\d{1,2}|\d{1,2})(?=\s|$|g/)', 'g/dL', None),
        ('haematology_report', 'Total RBC count', ['total rbc', 'rbc', 'erythrocyte'],
         r'total\s*rbc\s*(?:count)?[^0-9]{0,40}(\d+\.?\d*)', '', None),
        ('haematology_report', 'Platelet Count', ['platelet', 'plt'],
         r'platelet\s*count[^0-9]{0,50}(\d{4,7})', '', None),
        ('blood_indices', 'MCV', ['mcv'],
         r'(?:mean\s*corpuscular\s*volume|\bmcv\b)(?:\s*\([^)]*\))?[^0-9]{0,80}(\d{2,3})', 'fL', (60.0, 120.0)),
        ('blood_indices', 'RDW', ['rdw'],
         r'(?:red\s*cell\s*distribution\s*width|\brdw\b)(?:\s*\([^)]*\))?[^0-9]{0,80}(\d+\.?\d*)', '%', (9.0, 25.0)),
        ('blood_indices', 'Packed Cell Volume (PCV)', ['packed cell', 'pcv'],
         r'(?:packed\s*cell\s*volume|\(?\bpcv\b\)?)(?:\s*\([^)]*\))?[^0-9]{0,80}(\d{1,2}\.?\d*)', '%', (20.0, 65.0)),
    ]

    # MCH / MCHC: scan all numbers after label; skip left-hand side of "X - Y" ref bands (fixes 32.5 vs 33).
    mch_label = r'(?:\bmch\b|mean\s*corpuscular\s*hemoglobin(?!\s*concentration))'
    mchc_label = r'(?:\bmchc\b|mean\s*corpuscular\s*hemoglobin\s*concentration)'
    if not _cbc_row_value_plausible(
        parsed_data, ['mchc', 'hemoglobin concentration'], 30.0, 38.0
    ):
        val = _first_plausible_number_after_label(blob, mchc_label, 30.0, 38.0)
        if val:
            _fill_or_add_cbc_row(
                parsed_data,
                'blood_indices',
                'MCHC',
                ['mchc', 'hemoglobin concentration'],
                val,
                'g/dL',
                plausible=(30.0, 38.0),
            )
    if not _cbc_row_value_plausible(
        parsed_data,
        ['mch', 'corpuscular hemoglobin'],
        26.0,
        36.0,
        exclude_in_tn=['concentration'],
    ):
        val = _first_plausible_number_after_label(blob, mch_label, 26.0, 36.0)
        if val:
            _fill_or_add_cbc_row(
                parsed_data,
                'blood_indices',
                'MCH',
                ['mch', 'corpuscular hemoglobin'],
                val,
                'pg',
                plausible=(26.0, 36.0),
                exclude_in_tn=['concentration'],
            )

    for section, label, tokens, pattern, unit, plausible in specs:
        if plausible is not None:
            if _cbc_row_value_plausible(parsed_data, tokens, plausible[0], plausible[1]):
                continue
            val = _find_capture_in_range(
                blob,
                pattern,
                plausible[0],
                plausible[1],
                skip_if_reference_dash=True,
            )
            if val:
                _fill_or_add_cbc_row(
                    parsed_data, section, label, tokens, val, unit, plausible=plausible
                )
            continue
        if _cbc_row_has_value(parsed_data, tokens):
            continue
        m = re.search(pattern, blob, re.IGNORECASE)
        if not m:
            continue
        _fill_or_add_cbc_row(parsed_data, section, label, tokens, m.group(1), unit)

    wbc_tokens = ['total wbc', 'wbc', 'leucocyte', 'leukocyte', 'tlc']
    if not _cbc_row_value_plausible(parsed_data, wbc_tokens, 2500.0, 100000.0):
        wbc_val = _find_wbc_absolute_count(blob)
        if wbc_val:
            _fill_or_add_cbc_row(
                parsed_data,
                'haematology_report',
                'Total WBC count',
                wbc_tokens,
                wbc_val,
                '',
                plausible=(2500.0, 100000.0),
            )

    diff_specs = [
        ('Neutrophils', ['neutrophil'], r'neutrophils?\D{0,100}?(\d{1,2}\.?\d*)\b', '%', (35.0, 95.0)),
        (
            'Lymphocytes',
            ['lymphocyte'],
            r'lymphocytes?(?!\s*count)',
            '%',
            (12.0, 48.0),
        ),
        ('Eosinophils', ['eosinophil'], r'eosinophils?\D{0,100}?(\d{1,2}\.?\d*)\b', '%', (0.0, 20.0)),
        ('Monocytes', ['monocyte'], r'monocytes?\D{0,100}?(\d{1,2}\.?\d*)\b', '%', (0.0, 25.0)),
        ('Basophils', ['basophil'], r'basophils?\D{0,100}?(\d{1,2}\.?\d*)\b', '%', (0.0, 5.0)),
    ]
    for label, tokens, pattern, unit, plausible in diff_specs:
        if _cbc_row_value_plausible(parsed_data, tokens, plausible[0], plausible[1]):
            continue
        if label == 'Lymphocytes':
            val = _last_plausible_number_after_label(blob, pattern, plausible[0], plausible[1])
        else:
            val = _find_capture_in_range(
                blob,
                pattern,
                plausible[0],
                plausible[1],
                skip_if_reference_dash=False,
            )
        if val:
            _fill_or_add_cbc_row(
                parsed_data, 'haematology_report', label, tokens, val, unit, plausible=plausible
            )


def parse_universal_format(texts: List[str]) -> Dict[str, Any]:
    """
    Universal parser for blood reports.
    Extracts common fields and handles any format intelligently.
    """
    parsed_data = {
        "patient_info": {},
        "laboratory_info": {},
        "haematology_report": [],
        "blood_indices": [],
        "morphology": {},
        "footer_info": {},
        "other_fields": {}  # For unknown fields
    }
    
    if not texts:
        return parsed_data
    
    # Convert to list of strings
    texts = [str(t).strip() if t else "" for t in texts]
    
    i = 0
    in_haematology_section = False
    in_blood_indices_section = False
    in_morphology_section = False
    current_category = None
    
    while i < len(texts):
        text = texts[i]
        
        if not text or text in [':', '.', '"', "'"]:
            i += 1
            continue
        
        text_upper = text.upper()
        text_lower = text.lower()
        
        # Detect sections
        if any(x in text_upper for x in ['HAEMATOLOGY', 'HEMATOLOGY', 'CBC', 'COMPLETE BLOOD COUNT']):
            in_haematology_section = True
            in_blood_indices_section = False
            i += 1
            # Skip headers
            while i < len(texts) and texts[i].upper() in [
                'TEST DESCRIPTION', 'RESULT', 'RESULT(S)', 'REF. RANGE', 'REF. RANGE(S)', 'UNIT', 'UNIT(S)',
                'TEST NAME', 'OBSERVED VALUE', 'OBSERVED VALUE(S)', 'REFERENCE RANGE', 'REFERENCE RANGE(S)',
                'REFERENCE VALUE', 'REFERENCE VALUE(S)',
                'INVESTIGATION', 'UNITS', 'BIOLOGICAL REFERENCE INTERVAL', 'STATUS',
            ]:
                i += 1
            continue
        
        if any(x in text_upper for x in ['BLOOD INDICES', 'RBC INDICES', 'PLATELETS INDICES']):
            in_blood_indices_section = True
            in_haematology_section = False
            i += 1
            continue
        
        if any(x in text_upper for x in [
            'DIFFERENTIAL COUNT', 'DIFFERENTIAL WBC COUNT',
            'DIFFERENTIAL LEUCOCYTE COUNT', 'DIFFERENTIAL LEUKOCYTE COUNT',
        ]):
            current_category = "Differential Count"
            i += 1
            continue
        
        if any(x in text_upper for x in ['ABSOLUTE LEUCOCYTE COUNT', 'ABSOLUTE COUNT']):
            current_category = "Absolute Count"
            i += 1
            continue
        
        if any(x in text_upper for x in ['RBC MORPHOLOGY', 'PLATELETS ON SMEAR', 'MORPHOLOGY']):
            in_morphology_section = True
            i += 1
            continue
        
        # Parse patient info fields
        for field_name, keywords in COMMON_PATIENT_FIELDS.items():
            if matches_field(text, keywords):
                value = extract_value_after_colon(texts, i)
                if value:
                    # Handle age/gender split
                    if field_name == 'age_gender':
                        if '/' in value:
                            parts = value.split('/', 1)
                            if len(parts) == 2:
                                parsed_data["patient_info"]["age"] = parts[0].strip()
                                parsed_data["patient_info"]["gender"] = parts[1].strip()
                        else:
                            parsed_data["patient_info"][field_name] = value
                    else:
                        parsed_data["patient_info"][field_name] = value
                    i += 2
                    break
        
        # Parse laboratory info
        for field_name, keywords in COMMON_LAB_FIELDS.items():
            if matches_field(text, keywords):
                if field_name == 'name':
                    # Lab name might be in current text or next
                    lab_name = text
                    if i + 1 < len(texts) and not matches_field(texts[i + 1], COMMON_PATIENT_FIELDS):
                        next_text = texts[i + 1]
                        if not any(x in next_text.lower() for x in [':', 'date', 'no', 'id']):
                            lab_name = f"{text} {next_text}".strip()
                            i += 1
                    parsed_data["laboratory_info"]["name"] = lab_name
                else:
                    value = extract_value_after_colon(texts, i)
                    if value:
                        parsed_data["laboratory_info"][field_name] = value
                        i += 2
                        break
                i += 1
                break
        
        # Parse test results
        test_result = parse_test_result(texts, i)
        if test_result:
            next_i = test_result.pop('_next_index', None)
            test_name_lower = normalize_text(test_result['test_name'])
            
            # Determine if it's blood indices or haematology
            is_blood_index = any(
                keyword in test_name_lower 
                for keywords in [COMMON_TEST_NAMES['mcv'], COMMON_TEST_NAMES['mch'], 
                                COMMON_TEST_NAMES['mchc'], COMMON_TEST_NAMES['hct'],
                                COMMON_TEST_NAMES['rdw'], COMMON_TEST_NAMES['mpv'],
                                COMMON_TEST_NAMES['pct'], COMMON_TEST_NAMES['pdw']]
                for keyword in keywords
            )
            
            # Add category if applicable
            if current_category:
                test_result['category'] = current_category
            
            if is_blood_index or in_blood_indices_section:
                parsed_data["blood_indices"].append(test_result)
            else:
                parsed_data["haematology_report"].append(test_result)
            
            if next_i is not None:
                i = next_i
            else:
                # Advance index based on how many items we consumed
                i += 1
                if test_result['observed_value']:
                    i += 1
                if test_result['unit']:
                    i += 1
                if test_result['reference_range']:
                    i += 1
            continue
        
        # Parse morphology
        if in_morphology_section:
            for field_name, keywords in COMMON_MORPHOLOGY_FIELDS.items():
                if matches_field(text, keywords):
                    value = extract_value_after_colon(texts, i)
                    if value:
                        # Check if next item is also part of morphology
                        if i + 2 < len(texts):
                            next_text = texts[i + 2]
                            if not matches_field(next_text, COMMON_PATIENT_FIELDS) and not is_test_name(next_text):
                                value = f"{value} {next_text}".strip()
                                i += 1
                        parsed_data["morphology"][field_name] = value
                        i += 2
                        break
        
        # Parse footer info
        for field_name, keywords in COMMON_FOOTER_FIELDS.items():
            if matches_field(text, keywords):
                value = extract_value_after_colon(texts, i)
                if value:
                    parsed_data["footer_info"][field_name] = value
                    i += 2
                else:
                    # Sometimes the field name itself is the value (e.g., "Dr. Name")
                    parsed_data["footer_info"][field_name] = text
                    i += 1
                break
        
        # Store unknown fields in other_fields
        if i < len(texts):
            # Check if this looks like a key-value pair we haven't captured
            if ':' in text and i + 1 < len(texts):
                key = text.split(':')[0].strip()
                value = extract_value_after_colon(texts, i)
                if value and key and len(key) > 2:  # Only store meaningful keys
                    if key not in parsed_data["other_fields"]:
                        parsed_data["other_fields"][key] = value
                    else:
                        # If key exists, make it a list
                        if not isinstance(parsed_data["other_fields"][key], list):
                            parsed_data["other_fields"][key] = [parsed_data["other_fields"][key]]
                        parsed_data["other_fields"][key].append(value)
        
        i += 1
    
    joined = " ".join(t for t in texts if t)
    _enrich_cbc_from_fulltext(joined, parsed_data)
    return parsed_data


def generate_markdown(data: Dict[str, Any]) -> str:
    """
    Generate Markdown formatted output from structured data.
    """
    md = f"# Medical Report: {data.get('image_name', 'Unknown')}\n\n"
    
    if data.get('image_path'):
        md += f"**Image Path:** `{data['image_path']}`\n\n"
    
    if data.get('processed_at'):
        md += f"**Processed At:** {data['processed_at']}\n\n"
    
    # Patient Info
    if data.get('patient_info'):
        md += "## Patient Information\n\n"
        for key, value in data['patient_info'].items():
            if value:  # Only include non-empty values
                md += f"- **{key.replace('_', ' ').title()}:** {value}\n"
        md += "\n"
    
    # Laboratory Info
    if data.get('laboratory_info'):
        md += "## Laboratory Information\n\n"
        for key, value in data['laboratory_info'].items():
            if value:  # Only include non-empty values
                md += f"- **{key.replace('_', ' ').title()}:** {value}\n"
        md += "\n"
    
    # Haematology Report
    if data.get('haematology_report'):
        md += "## Haematology Report\n\n"
        md += "| Test Name | Observed Value | Unit | Reference Range |\n"
        md += "|-----------|----------------|------|-----------------|\n"
        for test in data['haematology_report']:
            test_name = str(test.get('test_name', '')).replace('|', '\\|')
            value = str(test.get('observed_value', '')).replace('|', '\\|')
            unit = str(test.get('unit', '')).replace('|', '\\|')
            ref_range = str(test.get('reference_range', '')).replace('|', '\\|')
            md += f"| {test_name} | {value} | {unit} | {ref_range} |\n"
        md += "\n"
    
    # Blood Indices
    if data.get('blood_indices'):
        md += "## Blood Indices\n\n"
        md += "| Test Name | Observed Value | Unit | Reference Range |\n"
        md += "|-----------|----------------|------|-----------------|\n"
        for test in data['blood_indices']:
            test_name = str(test.get('test_name', '')).replace('|', '\\|')
            value = str(test.get('observed_value', '')).replace('|', '\\|')
            unit = str(test.get('unit', '')).replace('|', '\\|')
            ref_range = str(test.get('reference_range', '')).replace('|', '\\|')
            md += f"| {test_name} | {value} | {unit} | {ref_range} |\n"
        md += "\n"
    
    # Morphology
    if data.get('morphology'):
        md += "## Morphology\n\n"
        for key, value in data['morphology'].items():
            if value:  # Only include non-empty values
                md += f"- **{key.replace('_', ' ').title()}:** {value}\n"
        md += "\n"
    
    # Footer Info
    if data.get('footer_info'):
        md += "## Footer Information\n\n"
        for key, value in data['footer_info'].items():
            if value:  # Only include non-empty values
                md += f"- **{key.replace('_', ' ').title()}:** {value}\n"
        md += "\n"
    
    # Other Fields
    if data.get('other_fields'):
        md += "## Other Fields\n\n"
        for key, value in data['other_fields'].items():
            if value:  # Only include non-empty values
                if isinstance(value, list):
                    md += f"- **{key.replace('_', ' ').title()}:** {', '.join(str(v) for v in value)}\n"
                else:
                    md += f"- **{key.replace('_', ' ').title()}:** {value}\n"
        md += "\n"
    
    return md
