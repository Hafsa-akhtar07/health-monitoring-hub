"""
Flask API for OCR extraction using PaddleOCR and medical report parsers.
This replaces the old python-ocr service.
"""
import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import cv2
from pathlib import Path
from paddleocr import PaddleOCR
from datetime import datetime
from parsers import parse_medical_report

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf', 'bmp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize PaddleOCR (lazy loading)
ocr_engine = None

def get_ocr_engine():
    """Lazy initialization of PaddleOCR - only initialize once"""
    global ocr_engine
    if ocr_engine is None:
        print("⚠️ Initializing PaddleOCR (this may take a moment on first use)...")
        try:
            ocr_engine = PaddleOCR(
                lang='en',
                use_textline_orientation=True,
                det_db_box_thresh=0.5,
                det_db_unclip_ratio=1.5
            )
            print("✅ PaddleOCR initialized and ready!")
        except Exception as e:
            print(f"❌ PaddleOCR initialization failed: {e}")
            raise
    return ocr_engine

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def preprocess_image(img):
    """
    Preprocess image for better OCR results.
    For WhatsApp images, upscaling and thresholding can help.
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

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy", 
        "service": "HMH-OCR-API (ocr-code)",
        "paddleocr_available": ocr_engine is not None
    })

@app.route('/api/extract', methods=['POST'])
def extract_report():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Please use: {ALLOWED_EXTENSIONS}'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    preprocessed_path = None
    
    try:
        print(f"🔍 Processing file: {filename}")
        
        # Get OCR engine (lazy initialization)
        ocr = get_ocr_engine()
        
        # Read image
        img = cv2.imread(filepath)
        if img is None:
            return jsonify({'error': 'Could not read image file'}), 400
        
        # Try OCR on original image first
        print("🔄 Running OCR on original image...")
        result = ocr.ocr(img)
        
        # If result is poor (very few detections), try with preprocessing
        if not result or not result[0] or len(result[0]) < 2:
            print("⚠️ Low detection count, trying with preprocessing...")
            processed_img = preprocess_image(img)
            result = ocr.ocr(processed_img)
        
        # Extract text from OCR result
        extracted_texts = []
        all_text = []
        
        if result:
            # Get first page (most images are single page)
            page_result = result[0] if isinstance(result, list) and len(result) > 0 else []
            
            if page_result:
                print(f"📊 Page result length: {len(page_result)}")
                for idx, detection in enumerate(page_result):
                    try:
                        if detection and len(detection) >= 2:
                            # detection[0] = bounding box [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                            # detection[1] = (text, confidence)
                            bbox = detection[0] if isinstance(detection[0], list) else []
                            text_info = detection[1]
                            
                            if isinstance(text_info, (list, tuple)) and len(text_info) >= 1:
                                text = str(text_info[0])
                                confidence = float(text_info[1]) if len(text_info) > 1 else 0.0
                            else:
                                text = str(text_info) if text_info else ''
                                confidence = 0.0
                            
                            if text and text.strip():
                                all_text.append(text.strip())
                                extracted_texts.append({
                                    'text': text.strip(),
                                    'confidence': confidence,
                                    'bbox': bbox,
                                    'index': idx
                                })
                    except Exception as parse_error:
                        print(f"⚠️ Error parsing detection {idx}: {parse_error}")
                        continue
        
        combined_text = '\n'.join(all_text)
        
        # Use parsers to extract structured medical report data
        structured_data = {}
        if all_text:
            try:
                # Parse medical report using ocr-code parsers
                structured_data = parse_medical_report(all_text)
                print(f"✅ Parsed structured data:")
                print(f"   - Patient info: {len(structured_data.get('patient_info', {}))} fields")
                print(f"   - Haematology tests: {len(structured_data.get('haematology_report', []))} tests")
                print(f"   - Blood indices: {len(structured_data.get('blood_indices', []))} indices")
            except Exception as parse_error:
                print(f"⚠️ Parser error (continuing with raw OCR): {parse_error}")
                import traceback
                traceback.print_exc()
                structured_data = {}
        
        # Build response - keep same format for compatibility
        response = {
            'success': True,
            'filename': filename,
            'ocr_result': extracted_texts,
            'all_text': combined_text,
            'total_detections': len(extracted_texts),
            'message': 'OCR completed successfully'
        }
        
        # Add structured data if available
        if structured_data:
            response['structured_data'] = structured_data
        
        print(f"✅ Extracted {len(extracted_texts)} text blocks")
        print(f"📄 Full extracted text ({len(combined_text)} chars):")
        print(combined_text[:500] + "..." if len(combined_text) > 500 else combined_text)
        print("=" * 80)
        
        # Show first few detections for debugging
        if extracted_texts:
            print("📊 First 10 detections:")
            for i, det in enumerate(extracted_texts[:10]):
                print(f"  {i+1}. Text: '{det['text']}' | Confidence: {det['confidence']:.2f}")
        
        return jsonify(response)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500
        
    finally:
        # Clean up uploaded files
        if os.path.exists(filepath):
            os.remove(filepath)

@app.route('/api/test', methods=['GET'])
def test_route():
    return jsonify({
        'message': 'OCR Service is running (ocr-code)',
        'endpoints': {
            'POST /api/extract': 'Upload image for OCR',
            'GET /health': 'Service health check',
            'GET /api/test': 'Test endpoint'
        },
        'paddleocr_available': ocr_engine is not None
    })

if __name__ == '__main__':
    print(f"🚀 Starting HMH OCR API (ocr-code) on http://127.0.0.1:5002")
    print(f"   - Using PaddleOCR with medical report parsers")
    print(f"   - Health check: GET http://127.0.0.1:5002/health")
    print(f"   - Upload endpoint: POST http://127.0.0.1:5002/api/extract")
    print(f"   - Test endpoint: GET http://127.0.0.1:5002/api/test")
    app.run(debug=True, port=5002)

