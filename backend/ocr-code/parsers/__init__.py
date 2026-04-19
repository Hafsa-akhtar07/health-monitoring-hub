"""
Medical report parsing — CBC-only path for API use.

All uploads are parsed with a single format-agnostic CBC extractor (see
cbc_core_extractor.py). Legacy per-lab parsers remain in the package for
reference but are not used by the OCR service.
"""

from .cbc_core_extractor import extract_cbc_core_fields


def parse_medical_report(
    rec_texts,
    all_text=None,
    *,
    rec_texts_scan_order=None,
    verbose: bool = True,
):
    """
    Parse OCR output and return structured haematology_report rows for the
    14 standard CBC parameters.

    Args:
        rec_texts: List of OCR line strings (geometry reading order).
        all_text: Optional full concatenated text (improves full-document regex).
        rec_texts_scan_order: Optional detector-native order (before geometry sort).

    Returns:
        Dict with haematology_report[], plus empty sections for API compatibility.
    """
    if not rec_texts:
        return {
            "patient_info": {},
            "laboratory_info": {},
            "haematology_report": [],
            "blood_indices": [],
            "morphology": {},
            "footer_info": {},
            "other_fields": {},
        }

    texts = [str(t).strip() for t in rec_texts if t and str(t).strip()]
    blob = all_text if all_text else None
    scan = None
    if rec_texts_scan_order:
        scan = [str(t).strip() for t in rec_texts_scan_order if t and str(t).strip()]
    return extract_cbc_core_fields(
        texts,
        all_text=blob,
        rec_texts_scan_order=scan,
        verbose=verbose,
    )
