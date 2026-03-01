"""
Flask API service that uses ocr-code modules for OCR processing.
This service accepts file uploads and returns structured JSON data.
"""

import os
import sys
import cv2
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime

# Add ocr-code directory to Python path so we can import from it
ocr_code_path = os.path.join(os.path.dirname(__file__), '..', 'ocr-code')
sys.path.insert(0, ocr_code_path)

# Import from ocr-code (without modifying ocr-code itself)
try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False
    print("⚠️ PaddleOCR not available. Install with: pip install paddleocr")

try:
    from parsers import parse_medical_report
    PARSERS_AVAILABLE = True
except ImportError as e:
    PARSERS_AVAILABLE = False
    print(f"⚠️ Parsers not available: {e}")

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'gif', 'tiff', 'webp', 'pdf'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Create uploads folder
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global PaddleOCR instance (lazy initialization)
ocr_engine = None

def get_ocr_engine():
    """Lazy initialization of PaddleOCR"""
    global ocr_engine
    if ocr_engine is None:
        print("⚠️ Initializing PaddleOCR (this may take a moment on first use)...")
        ocr_engine = PaddleOCR(
            lang='en',
            use_textline_orientation=True,
            det_db_box_thresh=0.5,
            det_db_unclip_ratio=1.5
        )
        print("✅ PaddleOCR initialized and ready!")
    return ocr_engine

def preprocess_image(img):
    """
    Preprocess image for better OCR results.
    From ocr-code/ocr_processor.py
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

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'OCR Service (using ocr-code)',
        'paddleocr_available': PADDLEOCR_AVAILABLE,
        'parsers_available': PARSERS_AVAILABLE,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/extract', methods=['POST'])
def extract_report():
    """Extract text from uploaded image using ocr-code logic"""
    if not PADDLEOCR_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'PaddleOCR is not available. Please install: pip install paddleocr'
        }), 500
    
    if not PARSERS_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Parsers are not available. Please check ocr-code/parsers directory.'
        }), 500
    
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': 'No file provided'
        }), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': 'No file selected'
        }), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400
    
    filepath = None
    preprocessed_path = None
    
    try:
        # Save uploaded file
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}")
        file.save(filepath)
        
        print(f"🔍 Processing file: {filename}")
        
        # Read image
        img = cv2.imread(filepath)
        if img is None:
            return jsonify({
                'success': False,
                'error': 'Could not read image file'
            }), 400
        
        # Get OCR engine
        ocr = get_ocr_engine()
        
        # Try OCR on original image first
        print("📊 Running OCR on original image...")
        result = ocr.ocr(img)
        
        # Extract text from OCR result
        all_text = ""
        rec_texts = []
        
        if result and isinstance(result, list) and len(result) > 0:
            first_item = result[0]
            
            # Handle different PaddleOCR result formats
            if isinstance(first_item, dict) and "rec_texts" in first_item:
                # New format: {"rec_texts": [...], "det_polys": [...]}
                rec_texts = first_item.get("rec_texts", [])
                all_text = " ".join([str(t).strip() for t in rec_texts if t])
            elif isinstance(first_item, list):
                # Old format: [[[bbox], (text, confidence)], ...]
                for line in first_item:
                    if isinstance(line, list) and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) and len(line[1]) > 0 else str(line[1])
                        rec_texts.append(text)
                        all_text += text + " "
        
        all_text = all_text.strip()
        total_detections = len(rec_texts)
        
        print(f"✅ Extracted {total_detections} text detections")
        print(f"📝 First 200 chars: {all_text[:200]}...")
        
        # If no results or very few detections, try with preprocessing
        if total_detections < 2:
            print("⚠️ Low detection count, trying with preprocessing...")
            processed_img = preprocess_image(img)
            result = ocr.ocr(processed_img)
            
            # Re-extract text from preprocessed result
            rec_texts = []
            all_text = ""
            
            if result and isinstance(result, list) and len(result) > 0:
                first_item = result[0]
                if isinstance(first_item, dict) and "rec_texts" in first_item:
                    rec_texts = first_item.get("rec_texts", [])
                    all_text = " ".join([str(t).strip() for t in rec_texts if t])
                elif isinstance(first_item, list):
                    for line in first_item:
                        if isinstance(line, list) and len(line) >= 2:
                            text = line[1][0] if isinstance(line[1], (list, tuple)) and len(line[1]) > 0 else str(line[1])
                            rec_texts.append(text)
                            all_text += text + " "
            
            all_text = all_text.strip()
            total_detections = len(rec_texts)
            print(f"✅ After preprocessing: {total_detections} text detections")
        
        # Parse medical report using ocr-code parsers
        structured_data = {}
        if rec_texts:
            print("🔍 Parsing medical report using ocr-code parsers...")
            structured_data = parse_medical_report(rec_texts)
            print(f"✅ Parsed data: Patient ID={structured_data.get('patient_info', {}).get('patient_id', 'N/A')}")
        
        # Prepare OCR result array (for compatibility with Node.js backend)
        ocr_result = []
        if result and isinstance(result, list) and len(result) > 0:
            first_item = result[0]
            if isinstance(first_item, dict) and "rec_texts" in first_item:
                # Convert to array format expected by Node.js
                for i, text in enumerate(first_item.get("rec_texts", [])):
                    ocr_result.append({
                        'text': str(text).strip(),
                        'index': i
                    })
            elif isinstance(first_item, list):
                for line in first_item:
                    if isinstance(line, list) and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], (list, tuple)) and len(line[1]) > 0 else str(line[1])
                        confidence = line[1][1] if isinstance(line[1], (list, tuple)) and len(line[1]) > 1 else 0.0
                        ocr_result.append({
                            'text': str(text).strip(),
                            'confidence': float(confidence) if confidence else 0.0
                        })
        
        # Prepare response (compatible with Node.js backend expectations)
        response_data = {
            'success': True,
            'filename': filename,
            'all_text': all_text,
            'total_detections': total_detections,
            'ocr_result': ocr_result,
            'structured_data': structured_data,  # Additional structured data from parsers
            'processed_at': datetime.now().isoformat()
        }
        
        # Print JSON to console as requested
        print("\n" + "="*60)
        print("📄 EXTRACTED JSON OUTPUT:")
        print("="*60)
        print(json.dumps(response_data, indent=2, ensure_ascii=False))
        print("="*60 + "\n")
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        error_msg = str(e) if str(e) else type(e).__name__
        print(f"❌ Error: {error_msg}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Processing failed: {error_msg}'
        }), 500
    
    finally:
        # Clean up uploaded file
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except:
                pass

if __name__ == '__main__':
    print("="*60)
    print("🚀 Starting HMH OCR API Service")
    print("="*60)
    print(f"📍 Using ocr-code modules from: {ocr_code_path}")
    print(f"🌐 Health check: GET http://127.0.0.1:5002/health")
    print(f"📤 Upload endpoint: POST http://127.0.0.1:5002/api/extract")
    print("="*60)
    app.run(host='127.0.0.1', port=5002, debug=True)

