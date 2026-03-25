"""
OCR Service for HMH Project
Uses ocr-code functionality without modifying it
Accepts image uploads and returns JSON results
"""
import os
import sys
import json
import cv2
import time
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime

# Add ocr-code to path to import its modules
ocr_code_path = Path(__file__).parent / "ocr-code"
sys.path.insert(0, str(ocr_code_path))

# Import from ocr-code (without modifying it)
from paddleocr import PaddleOCR
from parsers.universal_parser import parse_universal_format

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = Path("ocr-code") / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Initialize PaddleOCR (do this once at startup)
print("Initializing PaddleOCR...")
ocr = PaddleOCR(
    lang='en',
    use_textline_orientation=True,
    det_db_box_thresh=0.5,
    det_db_unclip_ratio=1.5
)
print("PaddleOCR initialized successfully!")


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def preprocess_image(img):
    """
    Preprocess image for better OCR results.
    For WhatsApp images, upscaling and thresholding can help.
    (Same function as in ocr_processor.py)
    """
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Upscale image (important for low-resolution WhatsApp images)
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # Apply adaptive threshold for better text contrast
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 2
    )
    
    return thresh


def process_image_with_ocr(image_path):
    """
    Process a single image using PaddleOCR and return structured data.
    Uses the same logic as ocr_processor.py without modifying it.
    """
    try:
        # Read image
        img = cv2.imread(str(image_path))
        if img is None:
            raise ValueError(f"Could not read image: {image_path}")
        
        # Try OCR on original image first (often works better)
        result = ocr.ocr(img)
        
        # If no results or very few detections, try with preprocessing
        if not result or not result[0] or len(result[0]) < 2:
            print(f"  [INFO] Trying with preprocessing...")
            processed_img = preprocess_image(img)
            result = ocr.ocr(processed_img)
        
        # Extract text and confidence from OCR result (same logic as ocr_processor.py)
        structured_data = {}
        rec_texts = []
        all_text = ""
        confidences = []  # Store confidence scores
        
        if result and isinstance(result, list) and len(result) > 0:
            first_item = result[0]
            if isinstance(first_item, dict) and "rec_texts" in first_item:
                # PaddleOCR result format with rec_texts dict
                rec_texts = first_item.get("rec_texts", [])
                all_text = "\n".join(rec_texts)
                # Extract confidence if available
                if "rec_scores" in first_item:
                    confidences = first_item.get("rec_scores", [])
                # Use universal parser directly (same as ocr_processor.py)
                structured_data = parse_universal_format(rec_texts)
            elif isinstance(first_item, list):
                # Standard PaddleOCR format: list of [bbox, (text, confidence)]
                for detection in first_item:
                    if isinstance(detection, list) and len(detection) >= 2:
                        text_info = detection[1]
                        if isinstance(text_info, (tuple, list)) and len(text_info) >= 2:
                            text = text_info[0]
                            confidence = text_info[1] if len(text_info) > 1 else None
                            if text:
                                rec_texts.append(text)
                                all_text += text + "\n"
                                if confidence is not None:
                                    confidences.append(confidence)
                        elif isinstance(text_info, (tuple, list)) and len(text_info) >= 1:
                            text = text_info[0]
                            if text:
                                rec_texts.append(text)
                                all_text += text + "\n"
                # Use universal parser
                if rec_texts:
                    structured_data = parse_universal_format(rec_texts)
        
        # Calculate average confidence/accuracy
        avg_confidence = 0.0
        if confidences:
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        accuracy_percentage = avg_confidence * 100 if avg_confidence > 0 else 0.0
        
        # Create final output (exact same format as ocr_processor.py)
        final_output = {
            "image_name": image_path.name,
            "image_path": str(image_path),
            "processed_at": datetime.now().isoformat(),
            **structured_data  # Unpack all structured fields directly (same as ocr_processor.py line 118)
        }
        
        # Add all_text, total_detections, and accuracy for API response (not in ocr-code JSON files)
        final_output["all_text"] = all_text.strip()
        final_output["total_detections"] = len(rec_texts)
        final_output["average_confidence"] = avg_confidence
        final_output["accuracy_percentage"] = accuracy_percentage
        final_output["confidence_scores"] = confidences if confidences else []
        
        return final_output, None
        
    except Exception as e:
        error_msg = str(e) if str(e) else type(e).__name__
        return None, error_msg


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "OK",
        "message": "OCR service is running",
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/extract', methods=['POST'])
def extract_text():
    """
    Extract text from uploaded image using PaddleOCR
    Returns JSON with extracted text and structured data
    """
    try:
        start_time = time.time()
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "No file provided"
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "No file selected"
            }), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "error": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            }), 400
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        file_path = UPLOAD_FOLDER / unique_filename
        
        file.save(str(file_path))
        print(f"📁 File saved: {file_path}")
        
        # Process image with OCR
        print(f"🔍 Processing image: {filename}")
        result, error = process_image_with_ocr(file_path)
        
        if error:
            # Clean up file
            if file_path.exists():
                file_path.unlink()
            return jsonify({
                "success": False,
                "error": error
            }), 500
        
        # Calculate duration
        duration_seconds = time.time() - start_time
        result["duration_seconds"] = duration_seconds
        
        # Log JSON to console with accuracy
        print("\n" + "=" * 80)
        print("📊 OCR EXTRACTION RESULT (JSON)")
        print("=" * 80)
        print(f"📈 OCR Accuracy: {result.get('accuracy_percentage', 0):.2f}% (Avg Confidence: {result.get('average_confidence', 0):.4f})")
        print(f"📝 Total Detections: {result.get('total_detections', 0)}")
        print(f"⏱️ Duration: {result.get('duration_seconds', 0):.2f} seconds")
        print("=" * 80)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print("=" * 80 + "\n")
        
        # Clean up uploaded file
        if file_path.exists():
            file_path.unlink()
        
        # Return success response
        return jsonify({
            "success": True,
            "ocr_result": result,
            "all_text": result.get("all_text", ""),
            "total_detections": result.get("total_detections", 0),
            "accuracy_percentage": result.get("accuracy_percentage", 0),
            "average_confidence": result.get("average_confidence", 0),
            "duration_seconds": result.get("duration_seconds", 0),
            "image_name": result.get("image_name", filename),
            "processed_at": result.get("processed_at")
        }), 200
        
    except Exception as e:
        error_msg = str(e) if str(e) else type(e).__name__
        print(f"❌ Error: {error_msg}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": error_msg
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    print(f"\n{'=' * 60}")
    print("OCR Service API (using ocr-code)")
    print(f"{'=' * 60}")
    print(f"Starting server on port {port}...")
    print(f"Health check: http://localhost:{port}/health")
    print(f"Extract endpoint: http://localhost:{port}/api/extract")
    print(f"{'=' * 60}\n")
    
    app.run(host='0.0.0.0', port=port, debug=True)

