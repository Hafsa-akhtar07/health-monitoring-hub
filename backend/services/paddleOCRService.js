// services/paddleOCRService.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class PaddleOCRService {
    constructor() {
        this.endpoints = [
            'https://aistudio.baidu.com/paddlehub-api/paddle/ocr',
            'https://ai.baidu.com/aidemo'
        ];
    }
    
    /**
     * Extract text from image using PaddleOCR
     */
    async extractText(imagePath, originalFilename) {
        let lastError = null;
        
        // Try each endpoint
        for (const endpoint of this.endpoints) {
            try {
                console.log(`🔄 Trying PaddleOCR endpoint: ${endpoint}`);
                
                const form = new FormData();
                form.append('image', fs.createReadStream(imagePath), {
                    filename: originalFilename,
                    contentType: 'image/jpeg'
                });
                
                const response = await axios.post(endpoint, form, {
                    headers: form.getHeaders(),
                    timeout: 30000
                });
                
                console.log(`✅ Success with endpoint: ${endpoint}`);
                
                // Parse response based on endpoint
                if (endpoint.includes('aistudio')) {
                    // Baidu AI Studio format
                    if (response.data && response.data.data) {
                        return {
                            success: true,
                            data: response.data.data,
                            raw: response.data
                        };
                    }
                } else if (endpoint.includes('baidu.com')) {
                    // Baidu AI format
                    if (response.data && response.data.words_result) {
                        return {
                            success: true,
                            data: response.data.words_result,
                            raw: response.data
                        };
                    }
                }
                
            } catch (error) {
                console.error(`❌ Failed with endpoint ${endpoint}:`, error.message);
                lastError = error;
                continue; // Try next endpoint
            }
        }
        
        // All endpoints failed
        throw lastError || new Error('All PaddleOCR endpoints failed');
    }
    
    /**
     * Extract CBC values from OCR text
     */
    extractCBCValues(ocrData) {
        const values = {};
        let allText = '';
        
        if (!Array.isArray(ocrData)) {
            return { values, allText };
        }
        
        // Combine all text
        ocrData.forEach(item => {
            if (item && (item.text || item.words)) {
                const text = (item.text || item.words || '').trim();
                if (text) {
                    allText += text + '\n';
                }
            }
        });
        
        // Parse CBC values (same pattern as before)
        const patterns = {
            hemoglobin: /(?:hemoglobin|haemoglobin|hb|hgb)[\s:]*(\d+\.?\d*)/gi,
            wbc: /(?:wbc|white\s*blood\s*cells?)[\s:]*(\d+\.?\d*)/gi,
            platelets: /(?:platelets?|plt)[\s:]*(\d+\.?\d*)/gi,
            rbc: /(?:rbc|red\s*blood\s*cells?)[\s:]*(\d+\.?\d*)/gi
            // Add more patterns as needed
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
            pattern.lastIndex = 0;
            const match = pattern.exec(allText.toLowerCase());
            if (match) {
                values[key] = parseFloat(match[1]);
            }
        }
        
        return {
            values,
            allText: allText.trim()
        };
    }
}

module.exports = new PaddleOCRService();