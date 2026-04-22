"""
Flask API service that uses ocr-code modules for OCR processing.
This service accepts file uploads and returns structured JSON data.

Speed / behaviour (env):
  OCR_MAX_EDGE              — max longest image side before OCR (default 1600; smaller = faster).
  OCR_USE_TEXTLINE_ORIENTATION — 1 to enable (slower on CPU). Default 0.
  OCR_TEXT_DET_LIMIT_SIDE_LEN — detection resize limit (default 960; lower = faster).
  OCR_SECOND_PASS           — (unused while second pass is commented out) future: 1 = preprocessed pass after original.
  OCR_LOG_FULL_JSON         — 1 = print full response JSON to terminal (slow on large text).
"""

import json
import os
import re
import sys
import traceback

# Paddle 3.x + OneDNN on Windows can raise NotImplementedError in onednn_instruction
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
import cv2
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

ocr_code_path = os.path.join(os.path.dirname(__file__), "..", "ocr-code")
sys.path.insert(0, ocr_code_path)

try:
    from paddleocr import PaddleOCR

    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    print("⚠️ PaddleOCR not available. Install with: pip install paddleocr")

try:
    from parsers import parse_medical_report
    from parsers.cbc_core_extractor import CANON_KEYS, summarize_fourteen_fields

    PARSERS_AVAILABLE = True
except ImportError as e:
    CANON_KEYS = []
    summarize_fourteen_fields = None  # type: ignore
    PARSERS_AVAILABLE = False
    print(f"⚠️ Parsers not available: {e}")

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "gif", "tiff", "webp", "pdf"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ocr_engine = None


def _env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)).strip())
    except ValueError:
        return default


def _env_int_any(names: list[str], default: int) -> int:
    """
    Read an int env var from the first present key in `names`.
    This makes deployments more robust across UI/typo variants.
    """
    for n in names:
        v = os.environ.get(n)
        if v is None:
            continue
        try:
            return int(str(v).strip())
        except ValueError:
            return default
    return default


# Defaults tuned for low-memory container apps.
# You can override via env vars (see _env_* above).
<<<<<<< HEAD
OCR_MAX_EDGE = _env_int_any(["OCR_MAX_EDGE", "OCR_MAXEDGE", "MAX_EDGE"], 800)
OCR_USE_TEXTLINE_ORI = _env_bool("OCR_USE_TEXTLINE_ORIENTATION", False)
OCR_DET_LIMIT_SIDE = _env_int_any(
    ["OCR_TEXT_DET_LIMIT_SIDE_LEN", "OCR_DET_LIMIT_SIDE_LEN", "DET_LIMIT_SIDE_LEN"],
    512,
=======
OCR_MAX_EDGE = _env_int_any(["OCR_MAX_EDGE", "OCR_MAXEDGE", "MAX_EDGE"], 1000)
OCR_USE_TEXTLINE_ORI = _env_bool("OCR_USE_TEXTLINE_ORIENTATION", False)
OCR_DET_LIMIT_SIDE = _env_int_any(
    ["OCR_TEXT_DET_LIMIT_SIDE_LEN", "OCR_DET_LIMIT_SIDE_LEN", "DET_LIMIT_SIDE_LEN"],
    640,
>>>>>>> ba5a3f07bad9678296e961b9f18ef97cef52ea3a
)
OCR_SECOND_PASS = _env_bool("OCR_SECOND_PASS", False)
OCR_LOG_FULL_JSON = _env_bool("OCR_LOG_FULL_JSON", False)


def _ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log_section(title: str, subtitle: str = "") -> None:
    print("")
    print("═" * 78)
    print(f"  [{_ts()}]  {title}")
    if subtitle:
        print(f"  {subtitle}")
    print("═" * 78)


def log_subsection(title: str) -> None:
    print("")
    print(f"  ─── {title} ───")


def resize_for_ocr(img, max_edge: int = OCR_MAX_EDGE):
    """Downscale large photos before OCR — largest win for CPU runtime."""
    if img is None:
        return None
    h, w = img.shape[:2]
    m = max(h, w)
    if m <= max_edge:
        return img
    scale = max_edge / float(m)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    out = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    log_subsection("Resize for OCR")
    print(f"  {w}x{h} → {new_w}x{new_h} (max edge {max_edge})")
    return out


def get_ocr_engine():
    """Lazy initialization — tuned for CPU speed by default."""
    global ocr_engine
    if ocr_engine is None:
        log_section("PaddleOCR init", "First request — loading models (may take a while)")
        print(
            f"  Settings: textline_orientation={OCR_USE_TEXTLINE_ORI}, "
            f"text_det_limit_side_len={OCR_DET_LIMIT_SIDE}"
        )
        ocr_engine = PaddleOCR(
            lang="en",
            device="cpu",
            enable_mkldnn=False,
            use_textline_orientation=OCR_USE_TEXTLINE_ORI,
            text_det_limit_side_len=OCR_DET_LIMIT_SIDE,
            det_db_box_thresh=0.5,
            det_db_unclip_ratio=1.5,
        )
        print("  ✅ PaddleOCR ready.")
    return ocr_engine


def preprocess_image(img):
    """
    Grayscale + mild upscale for small images + adaptive threshold.
    Avoids huge pixel counts (no 2× on already large resized images).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    max_dim = max(h, w)
    if max_dim < 900:
        scale = min(1.5, 900 / float(max_dim))
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    bh, bw = gray.shape[:2]
    block = min(31, max(11, (min(bh, bw) // 25) | 1))
    if block % 2 == 0:
        block += 1
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block, 2
    )
    return thresh


def _to_bgr(img):
    if img is None:
        return None
    if len(img.shape) == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img


def _poly_reading_key(poly) -> tuple:
    try:
        if hasattr(poly, "tolist"):
            poly = poly.tolist()
        pts = [p for p in poly]
        ys = [float(p[1]) for p in pts]
        xs = [float(p[0]) for p in pts]
        yc = sum(ys) / len(ys)
        xmin = min(xs)
        return (yc, xmin)
    except (TypeError, ValueError, IndexError, ZeroDivisionError):
        return (0.0, 0.0)


def sort_rec_texts_by_geometry(rec_texts: list, polys) -> list:
    if not rec_texts:
        return []
    if not polys or len(polys) != len(rec_texts):
        log_subsection("Reading order")
        print(
            f"  ⚠ No geometry sort: polys={'present' if polys else 'missing'}, "
            f"len_polys={len(polys) if polys else 0}, len_texts={len(rec_texts)}"
        )
        return [str(t).strip() for t in rec_texts if t and str(t).strip()]

    log_subsection("Reading order (sorted by box: top→bottom, left→right)")
    paired = []
    for txt, poly in zip(rec_texts, polys):
        key = _poly_reading_key(poly)
        paired.append((key[0], key[1], str(txt).strip()))
    paired.sort(key=lambda x: (x[0], x[1]))
    out = [p[2] for p in paired if p[2]]
    print(f"  Reordered {len(out)} line(s) using det_polys.")
    return out


def unwrap_ocr_result(result) -> tuple:
    if not result or not isinstance(result, list) or len(result) == 0:
        return [], None, "empty"
    first = result[0]
    if isinstance(first, dict):
        texts = list(first.get("rec_texts") or [])
        polys = (
            first.get("det_polys")
            or first.get("dt_polys")
            or first.get("rec_polys")
            or first.get("polys")
        )
        return texts, polys, "dict"
    if isinstance(first, list):
        texts = []
        for line in first:
            if isinstance(line, list) and len(line) >= 2:
                t = (
                    line[1][0]
                    if isinstance(line[1], (list, tuple)) and len(line[1]) > 0
                    else str(line[1])
                )
                texts.append(t)
        return texts, None, "legacy_list"
    return [], None, "empty"


def score_rec_texts(rec_texts: list) -> tuple:
    clean = [str(t).strip() for t in (rec_texts or []) if t and str(t).strip()]
    return len(clean), sum(len(s) for s in clean)


def run_ocr_and_normalize(ocr, img_bgr, pass_label: str):
    log_subsection(f"OCR run: {pass_label}")
    print(f"  Input image shape: {img_bgr.shape if img_bgr is not None else None}")

    t0 = datetime.now()
    raw = ocr.ocr(img_bgr)
    dt = (datetime.now() - t0).total_seconds()
    print(f"  ocr.ocr() wall time: {dt:.2f}s")

    rec_raw, polys, mode = unwrap_ocr_result(raw)
    print(f"  Unwrap mode: {mode} | raw line count: {len(rec_raw)}")

    rec_sorted = sort_rec_texts_by_geometry(rec_raw, polys)
    n_lines, n_chars = score_rec_texts(rec_sorted)
    all_text = " ".join(rec_sorted)
    print(f"  After sort: {n_lines} lines, {n_chars} non-space chars, all_text len={len(all_text)}")

    return {
        "result": raw,
        "rec_texts": rec_sorted,
        "rec_raw": rec_raw,
        "polys": polys,
        "unwrap_mode": mode,
        "all_text": all_text.strip(),
        "score_lines": n_lines,
        "score_chars": n_chars,
        "wall_seconds": dt,
    }


def count_cbc_rows(structured: dict) -> int:
    return len((structured or {}).get("haematology_report") or [])


def pick_best_pipeline(
    structured_orig: dict,
    structured_prep: dict | None,
    pass_orig: dict,
    pass_prep: dict | None,
) -> tuple:
    """
    Prefer more CBC rows, then higher OCR (lines, chars), then Original on tie.
    """
    co = count_cbc_rows(structured_orig)
    cp = count_cbc_rows(structured_prep) if structured_prep is not None else -1

    log_subsection("Choose pipeline for API structured_data")
    print(f"  Original:      CBC rows={co}, lines={pass_orig['score_lines']}, chars={pass_orig['score_chars']}")
    if pass_prep is not None and structured_prep is not None:
        print(
            f"  Preprocessed:  CBC rows={cp}, lines={pass_prep['score_lines']}, chars={pass_prep['score_chars']}"
        )
    else:
        print("  Preprocessed:  (skipped or failed)")
        return structured_orig, pass_orig, "Original", "preprocessed_unavailable"

    if cp > co:
        print("  ➜ Chosen: Preprocessed (more CBC fields parsed).")
        return structured_prep, pass_prep, "Preprocessed", "more_cbc_rows"
    if co > cp:
        print("  ➜ Chosen: Original (more CBC fields parsed).")
        return structured_orig, pass_orig, "Original", "more_cbc_rows"

    so = (pass_orig["score_lines"], pass_orig["score_chars"])
    sp = (pass_prep["score_lines"], pass_prep["score_chars"])
    if sp > so:
        print("  ➜ Chosen: Preprocessed (tie on CBC rows, higher OCR text score).")
        return structured_prep, pass_prep, "Preprocessed", "tiebreaker_ocr_score"
    print("  ➜ Chosen: Original (tie on CBC rows, equal or better OCR score).")
    return structured_orig, pass_orig, "Original", "tiebreaker_ocr_score"


def log_cbc_fourteen_table(summary: dict) -> None:
    log_section("CBC — 14 FIELDS (chosen pipeline)", "canonical keys → values")
    w = 18
    for key in CANON_KEYS:
        cell = summary.get(key) or {}
        if cell.get("found"):
            val = str(cell.get("observed_value", ""))
            unit = str(cell.get("unit", ""))
            tn = cell.get("test_name") or ""
            print(
                f"  {key.ljust(w)}  {val.ljust(14)}  {unit.ljust(12)}  |  {tn}"
            )
        else:
            print(f"  {key.ljust(w)}  {'—'.ljust(14)}  {'—'.ljust(12)}  |  (not found)")


def _pack_pass_raw(pass_dict: dict | None) -> dict | None:
    if pass_dict is None:
        return None
    rec_raw = pass_dict.get("rec_raw") or []
    return {
        "rec_texts_ordered": list(pass_dict.get("rec_texts") or []),
        "rec_texts_detector_order": [
            str(x).strip() for x in rec_raw if x and str(x).strip()
        ],
        "all_text": pass_dict.get("all_text") or "",
        "unwrap_mode": pass_dict.get("unwrap_mode"),
        "wall_seconds": pass_dict.get("wall_seconds"),
        "score_lines": pass_dict.get("score_lines"),
        "score_chars": pass_dict.get("score_chars"),
    }


def save_ocr_artifacts(
    ocr_root: str,
    source_filename: str,
    response_data: dict,
    pass_original: dict,
    pass_preprocessed: dict | None,
    chosen_rec_texts: list,
    chosen_all_text: str,
    cbc_fourteen: dict,
) -> tuple[str | None, str | None]:
    """Persist full extract JSON and raw OCR text bundles under ocr-code."""
    try:
        stem = os.path.splitext(os.path.basename(source_filename))[0]
        stem = re.sub(r"[^\w.\-]+", "_", stem).strip("_")[:80] or "image"
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = f"extract_{stamp}_{stem}"
        json_dir = os.path.join(ocr_root, "json_results")
        raw_dir = os.path.join(ocr_root, "raw_data")
        os.makedirs(json_dir, exist_ok=True)
        os.makedirs(raw_dir, exist_ok=True)

        json_path = os.path.join(json_dir, f"{base}.json")
        raw_path = os.path.join(raw_dir, f"{base}_raw.json")

        extract_payload = {
            "success": response_data.get("success"),
            "filename": response_data.get("filename"),
            "processed_at": response_data.get("processed_at"),
            "ocr_pass_used": response_data.get("ocr_pass_used"),
            "ocr_compare": response_data.get("ocr_compare"),
            "total_detections": response_data.get("total_detections"),
            "all_text": response_data.get("all_text"),
            "ocr_result": response_data.get("ocr_result"),
            "cbc_fourteen": cbc_fourteen,
            "structured_data": response_data.get("structured_data"),
            "structured_data_original": response_data.get("structured_data_original"),
            "structured_data_preprocessed": response_data.get(
                "structured_data_preprocessed"
            ),
        }

        raw_payload = {
            "source_filename": source_filename,
            "processed_at": response_data.get("processed_at"),
            "ocr_pass_used": response_data.get("ocr_pass_used"),
            "ocr_compare": response_data.get("ocr_compare"),
            "cbc_fourteen": cbc_fourteen,
            "chosen_rec_texts_ordered": list(chosen_rec_texts),
            "chosen_all_text": chosen_all_text or "",
            "pass_original": _pack_pass_raw(pass_original),
            "pass_preprocessed": _pack_pass_raw(pass_preprocessed),
        }

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(extract_payload, f, indent=2, ensure_ascii=False, default=str)
        with open(raw_path, "w", encoding="utf-8") as f:
            json.dump(raw_payload, f, indent=2, ensure_ascii=False, default=str)

        log_subsection("Artifacts saved")
        print(f"  json_results → {json_path}")
        print(f"  raw_data   → {raw_path}")
        return json_path, raw_path
    except Exception as e:
        log_subsection("Artifact save failed")
        print(f"  {type(e).__name__}: {e}")
        traceback.print_exc()
        return None, None


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify(
        {
            "status": "healthy",
            "service": "OCR Service (using ocr-code)",
            "paddleocr_available": PADDLEOCR_AVAILABLE,
            "parsers_available": PARSERS_AVAILABLE,
            "ocr_tuning": {
                "max_edge": OCR_MAX_EDGE,
                "textline_orientation": OCR_USE_TEXTLINE_ORI,
                "det_limit_side": OCR_DET_LIMIT_SIDE,
                "second_pass": OCR_SECOND_PASS,
            },
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/api/extract", methods=["POST"])
def extract_report():
    if not PADDLEOCR_AVAILABLE:
        return jsonify(
            {
                "success": False,
                "error": "PaddleOCR is not available. Please install: pip install paddleocr",
            }
        ), 500

    if not PARSERS_AVAILABLE:
        return jsonify(
            {
                "success": False,
                "error": "Parsers are not available. Please check ocr-code/parsers directory.",
            }
        ), 500

    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify(
            {
                "success": False,
                "error": f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}',
            }
        ), 400

    filepath = None

    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(
            UPLOAD_FOLDER, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
        )
        file.save(filepath)

        log_section("NEW REQUEST", f"file={filename!r}")

        img = cv2.imread(filepath)
        if img is None:
            return jsonify(
                {"success": False, "error": "Could not read image file"}
            ), 400

        print(f"  Raw image shape: {img.shape}, dtype={img.dtype}")
        img = resize_for_ocr(img, OCR_MAX_EDGE)

        ocr = get_ocr_engine()

        # ─── Pass 1: original (always) — full OCR + full parser logs
        log_section("PASS 1 — Original image", "OCR then CBC parse (verbose)")
        t_pass1 = datetime.now()
        pass_original = run_ocr_and_normalize(ocr, img, "1 — original BGR")
        structured_original: dict = {}
        if pass_original["rec_texts"]:
            structured_original = parse_medical_report(
                pass_original["rec_texts"],
                all_text=pass_original["all_text"],
                rec_texts_scan_order=pass_original.get("rec_raw"),
                verbose=True,
            )
        print(
            f"  Pass 1 CBC rows: {count_cbc_rows(structured_original)} "
            f"(parser wall ~{(datetime.now() - t_pass1).total_seconds():.2f}s total stage)"
        )

        # ─── Pass 2: preprocessed OCR (DISABLED for testing / faster runs)
        # Future: upscale + single high-quality pass, or re-enable dual-pass via OCR_SECOND_PASS.
        # if OCR_SECOND_PASS:
        #     log_section("PASS 2 — Preprocessed image", "OCR then CBC parse (quiet logs)")
        #     try:
        #         proc = preprocess_image(img)
        #         proc_bgr = _to_bgr(proc)
        #         pass_preprocessed = run_ocr_and_normalize(
        #             ocr, proc_bgr, "2 — preprocessed (adaptive threshold)"
        #         )
        #         if pass_preprocessed["rec_texts"]:
        #             structured_preprocessed = parse_medical_report(
        #                 pass_preprocessed["rec_texts"],
        #                 all_text=pass_preprocessed["all_text"],
        #                 rec_texts_scan_order=pass_preprocessed.get("rec_raw"),
        #                 verbose=False,
        #             )
        #         else:
        #             structured_preprocessed = parse_medical_report(
        #                 [], all_text="", verbose=False
        #             )
        #         print(
        #             f"  Pass 2 CBC rows: {count_cbc_rows(structured_preprocessed)}"
        #         )
        #     except Exception as e:
        #         preprocessed_error = f"{type(e).__name__}: {e}"
        #         log_section("PASS 2 FAILED (using Pass 1 only)", preprocessed_error)
        #         traceback.print_exc()
        # else:
        #     log_section("PASS 2 skipped", "OCR_SECOND_PASS=0 or false")

        pass_preprocessed = None
        structured_preprocessed = None
        preprocessed_error = None
        log_section("PASS 2 — disabled", "single OCR pass only (testing); uncomment block above to re-enable")

        structured_data, chosen_pass, chosen_label, reason = pick_best_pipeline(
            structured_original,
            structured_preprocessed,
            pass_original,
            pass_preprocessed,
        )

        result = chosen_pass["result"]
        rec_texts = chosen_pass["rec_texts"]
        all_text = chosen_pass["all_text"]
        total_detections = len(rec_texts)

        log_section(
            "SELECTED FOR API RESPONSE",
            f"{chosen_label} | reason={reason} | detections={total_detections}",
        )
        if total_detections:
            for i, line in enumerate(rec_texts[:12]):
                print(f"    [{i:03d}] {line[:140]!r}")
            if total_detections > 12:
                print(f"    ... {total_detections - 12} more line(s)")

        ocr_result = []
        if result and isinstance(result, list) and len(result) > 0:
            first_item = result[0]
            if isinstance(first_item, dict) and "rec_texts" in first_item:
                for i, text in enumerate(first_item.get("rec_texts", [])):
                    ocr_result.append({"text": str(text).strip(), "index": i})
            elif isinstance(first_item, list):
                for line in first_item:
                    if isinstance(line, list) and len(line) >= 2:
                        text = (
                            line[1][0]
                            if isinstance(line[1], (list, tuple)) and len(line[1]) > 0
                            else str(line[1])
                        )
                        conf = (
                            line[1][1]
                            if isinstance(line[1], (list, tuple)) and len(line[1]) > 1
                            else 0.0
                        )
                        ocr_result.append(
                            {
                                "text": str(text).strip(),
                                "confidence": float(conf) if conf else 0.0,
                            }
                        )

        ocr_compare = {
            "original": {
                "score_lines": pass_original["score_lines"],
                "score_chars": pass_original["score_chars"],
                "cbc_row_count": count_cbc_rows(structured_original),
                "ocr_seconds": pass_original.get("wall_seconds"),
                "total_detections": len(pass_original["rec_texts"]),
            },
            "preprocessed": None,
            "chosen": chosen_label,
            "reason": reason,
            "preprocessed_error": preprocessed_error,
        }
        if pass_preprocessed is not None:
            ocr_compare["preprocessed"] = {
                "score_lines": pass_preprocessed["score_lines"],
                "score_chars": pass_preprocessed["score_chars"],
                "cbc_row_count": count_cbc_rows(structured_preprocessed or {}),
                "ocr_seconds": pass_preprocessed.get("wall_seconds"),
                "total_detections": len(pass_preprocessed["rec_texts"]),
            }

        response_data = {
            "success": True,
            "filename": filename,
            "all_text": all_text,
            "total_detections": total_detections,
            "ocr_pass_used": chosen_label,
            "ocr_compare": ocr_compare,
            "ocr_result": ocr_result,
            "structured_data": structured_data,
            "structured_data_original": structured_original,
            "structured_data_preprocessed": structured_preprocessed,
            "processed_at": datetime.now().isoformat(),
        }

        cbc_fourteen = summarize_fourteen_fields(structured_data)
        response_data["cbc_fourteen"] = cbc_fourteen
        log_cbc_fourteen_table(cbc_fourteen)
        save_ocr_artifacts(
            ocr_code_path,
            filename,
            response_data,
            pass_original,
            pass_preprocessed,
            rec_texts,
            all_text,
            cbc_fourteen,
        )

        log_section("RESPONSE SUMMARY")
        print(
            json.dumps(
                {
                    "success": True,
                    "filename": filename,
                    "total_detections": total_detections,
                    "ocr_pass_used": chosen_label,
                    "cbc_rows_chosen": count_cbc_rows(structured_data),
                    "ocr_compare": ocr_compare,
                },
                indent=2,
            )
        )
        if OCR_LOG_FULL_JSON:
            print("\n  Full response_data (OCR_LOG_FULL_JSON=1):")
            print(json.dumps(response_data, indent=2, ensure_ascii=False))
        print("═" * 78 + "\n")

        return jsonify(response_data)

    except Exception as e:
        error_msg = str(e) if str(e) else type(e).__name__
        log_section("ERROR", error_msg)
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Processing failed: {error_msg}"}), 500

    finally:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass


if __name__ == "__main__":
    print("=" * 78)
    print("  HMH OCR API")
    print(f"  max_edge={OCR_MAX_EDGE}  textline_ori={OCR_USE_TEXTLINE_ORI}  "
          f"det_limit={OCR_DET_LIMIT_SIDE}  second_pass={OCR_SECOND_PASS}")
    print(f"  ocr-code path: {ocr_code_path}")
    port = int(os.environ.get("PORT", os.environ.get("OCR_SERVICE_PORT", "5002")))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"  Health: GET  http://{host}:{port}/health")
    print("=" * 78)
    app.run(host=host, port=port, debug=False)
