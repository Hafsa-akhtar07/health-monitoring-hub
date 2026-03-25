import os
from typing import Dict, Any, List

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="HMH CBC ML Service")


class CBCRequest(BaseModel):
    cbcData: Dict[str, Any]


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths to trained artifacts – now using the `Model` folder in repo root
# NOTE: We only READ these, your original training code is untouched.
MODEL_DIR = os.path.join(BASE_DIR, "..", "Model")

MODEL_CORE_PATH = os.path.join(MODEL_DIR, "model_1_core_cbc.pkl")
MODEL_DIFF_PATH = os.path.join(MODEL_DIR, "model_2_cbc_diff.pkl")
# Encoder filenames must match exactly what is present in the Model folder
ENC_CORE_PATH = os.path.join(MODEL_DIR, "label_encoder_m1.pkl")
ENC_DIFF_PATH = os.path.join(MODEL_DIR, "label_encoder_m2.pkl")


def _load_model(path: str):
    # Most scikit-learn models are saved with joblib; this will NOT touch your training code
    return joblib.load(path)


try:
    model_core = _load_model(MODEL_CORE_PATH)
    model_diff = _load_model(MODEL_DIFF_PATH)
    label_enc_core = _load_model(ENC_CORE_PATH)
    label_enc_diff = _load_model(ENC_DIFF_PATH)
except Exception as e:
    # Fail fast in standalone run; Node side will see service down if this happens
    raise RuntimeError(f"Failed to load ML artifacts: {e}")


"""
IMPORTANT: this does NOT change your training notebooks / model code.
It only defines how we read values coming from Node into feature vectors.

We have two models:
- model_1_core_cbc.pkl  → used when NO WBC differentials are present
- model_2_cbc_diff.pkl  → used when ANY of neutrophils / lymphocytes /
                           monocytes / eosinophils / basophils are present
"""

CORE_FEATURES: List[str] = [
    "hemoglobin",
    "rbc",
    "wbc",
    "platelets",
    "hematocrit",
    "mcv",
    "mch",
    "mchc",
    "rdw",
]

DIFF_ONLY_FEATURES: List[str] = [
    "neutrophils",
    "lymphocytes",
    "monocytes",
    "eosinophils",
    "basophils",
]

# Mapping from our canonical keys (used by Node/backend) to
# the column names that were used when training the models.
# NOTE: These must match the pandas DataFrame column names
# that were used in your notebooks.
CANONICAL_TO_MODEL_FEATURE: Dict[str, str] = {
    # Core CBC
    "hemoglobin": "Hb",
    "rbc": "RBC",
    "wbc": "WBC",
    # The sklearn models were trained with the exact feature name `PLATELETS`
    # (NOT `PLT`).
    "platelets": "PLATELETS",
    "hematocrit": "HCT",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "rdw": "RDW",
    # Differential counts (percentages)
    "neutrophils": "NEUT",
    "lymphocytes": "LYMP",
    "monocytes": "MONO",
    "eosinophils": "EO",
    "basophils": "BASO",
}

# Inverse map: model feature name -> our canonical key
MODEL_FEATURE_TO_CANONICAL: Dict[str, str] = {
    model_name: canonical for canonical, model_name in CANONICAL_TO_MODEL_FEATURE.items()
}


def build_feature_dataframe(cbc: Dict[str, Any], model) -> pd.DataFrame:
    """
    Build a one-row DataFrame whose columns exactly match the feature
    names the model was trained with (model.feature_names_in_).
    """
    feature_names = list(getattr(model, "feature_names_in_", []))

    # Fallback: if model doesn't expose feature names, just use our core list
    if not feature_names:
        # This should rarely happen for sklearn models trained on DataFrames
        feature_names = list(CANONICAL_TO_MODEL_FEATURE.values())

    # If a feature is missing from OCR (e.g. RDW not found by regex),
    # we impute with a "normal-range" default so the ML model doesn't see 0.
    #
    # RDW reference range in this app: 11.5 - 14.5 (%)
    # Use midpoint to represent "normal".
    RDW_IMPUTED_NORMAL: float = 13.0

    row: Dict[str, float] = {}
    rdw_imputed = False

    for fname in feature_names:
        # Map training feature name back to our canonical key, if possible
        canonical_key = MODEL_FEATURE_TO_CANONICAL.get(fname, None)
        source_key = canonical_key or fname  # if already same name

        val = cbc.get(source_key)
        if val is None or val == "":
            if canonical_key == "rdw":
                row[fname] = RDW_IMPUTED_NORMAL
                rdw_imputed = True
            else:
                row[fname] = 0.0
        else:
            try:
                parsed = float(val)
                if canonical_key == "rdw" and (parsed == 0.0):
                    row[fname] = RDW_IMPUTED_NORMAL
                    rdw_imputed = True
                else:
                    row[fname] = parsed
            except (TypeError, ValueError):
                if canonical_key == "rdw":
                    row[fname] = RDW_IMPUTED_NORMAL
                    rdw_imputed = True
                else:
                    row[fname] = 0.0

    if rdw_imputed:
        print(f"[ML-SERVICE] Imputed RDW={RDW_IMPUTED_NORMAL}% (normal-range default because RDW missing)")

    return pd.DataFrame([row], columns=feature_names)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(req: CBCRequest):
    cbc = req.cbcData or {}

    try:
        # Log the exact numeric inputs we feed into the ML model.
        # This helps diagnose unit mismatches (e.g., platelets x10^9/L vs cells/µL).
        input_keys = [
            "hemoglobin", "rbc", "wbc", "platelets",
            "neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"
        ]
        # rdw is important because it is missing often; include it if present.
        input_snapshot = {k: cbc.get(k) for k in input_keys}
        input_snapshot["rdw"] = cbc.get("rdw")
        print(f"[ML-SERVICE] inputSnapshot={input_snapshot}")

        # Decide which model to use based on presence of WBC differentials
        has_differentials = any(
            cbc.get(f) not in (None, "")
            for f in DIFF_ONLY_FEATURES
        )

        # Choose model + encoder
        if has_differentials:
            # Model 2: CBC with differentials
            X = build_feature_dataframe(cbc, model_diff)
            pred_idx = model_diff.predict(X)[0]
            try:
                label = label_enc_diff.inverse_transform([pred_idx])[0]
            except Exception:
                label = str(pred_idx)

            conf = None
            probs = {}
            if hasattr(model_diff, "predict_proba"):
                proba_arr = model_diff.predict_proba(X)[0]
                classes = getattr(label_enc_diff, "classes_", None)
                if classes is not None:
                    for cls, p in zip(classes, proba_arr):
                        probs[str(cls)] = float(p)
                conf = float(max(proba_arr))

            used_model = "model_2_cbc_diff.pkl"
        else:
            # Model 1: core CBC only
            X = build_feature_dataframe(cbc, model_core)
            pred_idx = model_core.predict(X)[0]
            try:
                label = label_enc_core.inverse_transform([pred_idx])[0]
            except Exception:
                label = str(pred_idx)

            conf = None
            probs = {}
            if hasattr(model_core, "predict_proba"):
                proba_arr = model_core.predict_proba(X)[0]
                classes = getattr(label_enc_core, "classes_", None)
                if classes is not None:
                    for cls, p in zip(classes, proba_arr):
                        probs[str(cls)] = float(p)
                conf = float(max(proba_arr))

            used_model = "model_1_core_cbc.pkl"

        # Basic mapping back into the structure expected by Node `/api/analyze`
        predicted_class = str(label).strip()  # label encoder output (condition classes)
        severity_raw = predicted_class
        severity_norm = severity_raw.lower()
        # fallback if your labels are different (e.g., "0/1/2")
        mapping = {
            "0": "normal",
            "1": "abnormal",
            "2": "critical",
            "normal": "normal",
            "mild": "abnormal",
            "moderate": "abnormal",
            "critical": "critical",
        }
        severity = mapping.get(severity_norm, mapping.get(severity_raw, "abnormal"))

        response = {
            "severity": severity,
            "confidence": conf if conf is not None else 0.7,
            "predictions": probs if probs else {severity: 1.0},
            "note": "Real ML prediction from trained CBC model",
            "usedModel": used_model,
            "predictedClass": predicted_class,
            "usedDifferentials": has_differentials,
        }

        # Log model details and confidence to the ML service terminal
        print(
            f"[ML-SERVICE] usedModel={used_model}, "
            f"predictedClass={predicted_class}, "
            f"severity={severity}, "
            f"confidence={response['confidence']:.4f}"
        )

        return response

    except Exception as e:
        # Log full error server-side and return a graceful fallback
        print(f"[ML-SERVICE] Prediction failed: {repr(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("ML_SERVICE_PORT", "5001"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)


