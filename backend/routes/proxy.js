const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();

/**
 * POST /api/proxy/paddleocr
 * Proxy for Baidu PaddleOCR API (to avoid CORS issues from frontend)
 */
router.post('/paddleocr', async (req, res) => {
  try {
    console.log('🔄 Proxying to Baidu PaddleOCR API...');
    
    // Check if we have image data
    const imageData = req.body.image;
    
    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'No image data provided'
      });
    }

    // Convert base64 to buffer if needed
    let imageBuffer;
    if (imageData.startsWith('data:')) {
      // Remove data URL prefix
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Assume it's already base64
      imageBuffer = Buffer.from(imageData, 'base64');
    }

    // Create form data for Baidu API
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'medical_report.jpg',
      contentType: 'image/jpeg'
    });

    // Try multiple endpoints
    const endpoints = [
      'https://aistudio.baidu.com/paddlehub-api/paddle/ocr',
      'https://ai.baidu.com/aidemo'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`📤 Proxying to: ${endpoint}`);
        
        const response = await axios.post(endpoint, form, {
          headers: form.getHeaders(),
          timeout: 30000
        });

        console.log(`✅ Proxy success with ${endpoint}`);
        
        // Return the OCR result
        let ocrData = [];
        
        if (endpoint.includes('aistudio') && response.data && response.data.data) {
          ocrData = response.data.data;
        } else if (endpoint.includes('baidu.com') && response.data && response.data.words_result) {
          ocrData = response.data.words_result;
        } else {
          ocrData = response.data || [];
        }
        
        return res.json({
          success: true,
          data: ocrData,
          endpoint: endpoint
        });
        
      } catch (error) {
        console.error(`❌ Proxy failed with ${endpoint}:`, error.message);
        if (endpoint === endpoints[endpoints.length - 1]) {
          // Last endpoint failed
          throw error;
        }
        continue; // Try next endpoint
      }
    }
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Proxy failed'
    });
  }
});

/**
 * GET /api/proxy/health
 * Check if proxy is working
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'PaddleOCR Proxy',
    endpoints: [
      'POST /api/proxy/paddleocr'
    ]
  });
});

module.exports = router;