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

MODEL_DIR = os.path.join(BASE_DIR, "..", "Model")

MODEL_CORE_PATH = os.path.join(MODEL_DIR, "model_1_core_cbc.pkl")
MODEL_DIFF_PATH = os.path.join(MODEL_DIR, "model_2_cbc_diff.pkl")
ENC_CORE_PATH = os.path.join(MODEL_DIR, "label_encoder_m1.pkl")
ENC_DIFF_PATH = os.path.join(MODEL_DIR, "label_encoder_m2.pkl")


def _load_model(path: str):
    return joblib.load(path)


try:
    model_core = _load_model(MODEL_CORE_PATH)
    model_diff = _load_model(MODEL_DIFF_PATH)
    label_enc_core = _load_model(ENC_CORE_PATH)
    label_enc_diff = _load_model(ENC_DIFF_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load ML artifacts: {e}")


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
    "lymphocytes",
    "monocytes",
]

CANONICAL_TO_MODEL_FEATURE: Dict[str, str] = {
    "hemoglobin": "Hb",
    "rbc": "RBC",
    "wbc": "WBC",
    "platelets": "PLATELETS",
    "hematocrit": "HCT",
    "mcv": "MCV",
    "mch": "MCH",
    "mchc": "MCHC",
    "rdw": "RDW",
    "lymphocytes": "LYMP",
    "monocytes": "MONO",
}

MODEL_FEATURE_TO_CANONICAL: Dict[str, str] = {
    model_name: canonical for canonical, model_name in CANONICAL_TO_MODEL_FEATURE.items()
}


def build_feature_dataframe(cbc: Dict[str, Any], model) -> pd.DataFrame:
    feature_names = list(getattr(model, "feature_names_in_", []))

    if not feature_names:
        feature_names = list(CANONICAL_TO_MODEL_FEATURE.values())

    RDW_IMPUTED_NORMAL: float = 13.0

    row: Dict[str, float] = {}
    rdw_imputed = False

    for fname in feature_names:
        canonical_key = MODEL_FEATURE_TO_CANONICAL.get(fname, None)
        source_key = canonical_key or fname

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
        input_keys = [
            "hemoglobin",
            "rbc",
            "wbc",
            "platelets",
            "lymphocytes",
            "monocytes",
        ]
        input_snapshot = {k: cbc.get(k) for k in input_keys}
        input_snapshot["rdw"] = cbc.get("rdw")
        print(f"[ML-SERVICE] inputSnapshot={input_snapshot}")

        has_differentials = any(
            cbc.get(f) not in (None, "")
            for f in DIFF_ONLY_FEATURES
        )

        if has_differentials:
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

        predicted_class = str(label).strip()
        severity_raw = predicted_class
        severity_norm = severity_raw.lower()
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

        print(
            f"[ML-SERVICE] usedModel={used_model}, "
            f"predictedClass={predicted_class}, "
            f"severity={severity}, "
            f"confidence={response['confidence']:.4f}"
        )

        return response

    except Exception as e:
        print(f"[ML-SERVICE] Prediction failed: {repr(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", os.getenv("ML_SERVICE_PORT", "5001")))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
