# Health Monitoring Hub - Backend API

Backend API server for the Health Monitoring Hub project.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Set up PostgreSQL database:
```bash
# Create database
createdb health_monitoring_hub

# Or using psql:
psql -U postgres
CREATE DATABASE health_monitoring_hub;
```

4. Start the server:
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📋 API Endpoints

### Health Check
- `GET /health` - Check API status

### Upload
- `POST /api/upload` - Upload CBC report image/PDF
  - Content-Type: `multipart/form-data`
  - Body: `file` (image/PDF file)

### Reports
- `POST /api/reports` - Save manually entered CBC report
- `GET /api/reports` - Get all reports (with pagination)
- `GET /api/reports/:id` - Get specific report
- `DELETE /api/reports/:id` - Delete a report

### Analysis
- `POST /api/analyze` - Analyze CBC values
  - Body: `{ cbcData: {...}, reportId?: number, gender?: string }`

## 🗄️ Database Schema

The database will be automatically initialized on first run with the following tables:

- `users` - User accounts
- `reports` - CBC reports
- `analyses` - Analysis results

## 🔧 Configuration

Edit `.env` file to configure:
- Database connection
- Server port
- ML service URL
- Other environment-specific settings

## 📝 Development

### Project Structure
```
backend/
├── config/
│   └── database.js      # Database configuration
├── routes/
│   ├── upload.js        # Upload endpoints
│   ├── reports.js       # Report endpoints
│   └── analyze.js       # Analysis endpoints
├── services/
│   ├── ocrService.js    # OCR extraction service
│   ├── ruleDetection.js # Rule-based detection
│   └── referenceRanges.js # CBC reference ranges
├── server.js            # Main server file
└── package.json
```

## 🧪 Testing

Test endpoints using Postman or curl:

```bash
# Health check
curl http://localhost:5000/health

# Upload file
curl -X POST -F "file=@report.jpg" http://localhost:5000/api/upload

# Analyze CBC data
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"cbcData": {"hemoglobin": 12.5, "rbc": 4.5, "wbc": 7000, "platelets": 250000}}'
```

## 📚 Notes

- OCR service is currently using mock data. Replace with actual Tesseract OCR implementation.
- ML service integration is optional. If ML service is unavailable, rule-based detection will be used.
- File uploads are stored in `uploads/` directory (created automatically).

