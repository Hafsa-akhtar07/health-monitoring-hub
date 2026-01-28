import os
from typing import Dict, Any, List

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="HMH CBC ML Service")


class CBCRequest(BaseModel):
    cbcData: Dict[str, Any]


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths to trained artifacts – we only READ these, not modify them
FYP_MATERIAL_DIR = os.path.join(BASE_DIR, "..", "fyp_material")

MODEL_CORE_PATH = os.path.join(FYP_MATERIAL_DIR, "model_1_core_cbc.pkl")
MODEL_DIFF_PATH = os.path.join(FYP_MATERIAL_DIR, "model_2_cbc_diff.pkl")
ENC_CORE_PATH = os.path.join(FYP_MATERIAL_DIR, "label_encoder_m1.pkl")
ENC_DIFF_PATH = os.path.join(FYP_MATERIAL_DIR, "label_encoder_m2.pkl")


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


# IMPORTANT: this does NOT change your training code.
# It just defines how we read values coming from Node into a feature vector.
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(req: CBCRequest):
    cbc = req.cbcData or {}

    try:
        # Build feature vector in same order we decided above
        core_vec = []
        for feature in CORE_FEATURES:
            val = cbc.get(feature)
            if val is None or val == "":
                core_vec.append(0.0)
            else:
                try:
                    core_vec.append(float(val))
                except ValueError:
                    core_vec.append(0.0)

        # Model 1: core CBC severity / class
        core_pred_idx = model_core.predict([core_vec])[0]
        try:
            core_label = label_enc_core.inverse_transform([core_pred_idx])[0]
        except Exception:
            core_label = str(core_pred_idx)

        core_conf = None
        core_probs = {}
        if hasattr(model_core, "predict_proba"):
            proba_arr = model_core.predict_proba([core_vec])[0]
            classes = getattr(label_enc_core, "classes_", None)
            if classes is not None:
                for cls, p in zip(classes, proba_arr):
                    core_probs[str(cls)] = float(p)
            core_conf = float(max(proba_arr))

        # Basic mapping back into the structure expected by Node `/api/analyze`
        severity = str(core_label)
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
        severity = mapping.get(severity, "abnormal")

        response = {
            "severity": severity,
            "confidence": core_conf if core_conf is not None else 0.7,
            "predictions": core_probs if core_probs else {severity: 1.0},
            "note": "Real ML prediction from trained CBC model_1_core_cbc.pkl",
        }

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("ML_SERVICE_PORT", "5001"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)


