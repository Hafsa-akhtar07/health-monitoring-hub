   import React, { useState } from 'react';
   import axios from 'axios';

   function UploadReport({ onUploadSuccess }) {
     const [file, setFile] = useState(null);
     const [preview, setPreview] = useState(null);
     const [uploading, setUploading] = useState(false);
     const [error, setError] = useState(null);

     const handleFileChange = (e) => {
       const selectedFile = e.target.files[0];
       if (!selectedFile) return;

       // Validate file type
       const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
       if (!validTypes.includes(selectedFile.type)) {
         setError('Please upload a JPEG, PNG, or PDF file');
         return;
       }

       // Validate file size (max 10MB)
       if (selectedFile.size > 10 * 1024 * 1024) {
         setError('File size must be less than 10MB');
         return;
       }

       setFile(selectedFile);
       setError(null);

       // Create preview for images
       if (selectedFile.type.startsWith('image/')) {
         const reader = new FileReader();
         reader.onloadend = () => {
           setPreview(reader.result);
         };
         reader.readAsDataURL(selectedFile);
       } else {
         setPreview(null);
       }
     };

     const handleDragOver = (e) => {
       e.preventDefault();
       e.stopPropagation();
     };

     const handleDrop = (e) => {
       e.preventDefault();
       e.stopPropagation();
       const droppedFile = e.dataTransfer.files[0];
       if (droppedFile) {
         const event = { target: { files: [droppedFile] } };
         handleFileChange(event);
       }
     };

     const handleUpload = async () => {
       if (!file) {
         setError('Please select a file first');
         return;
       }

       setUploading(true);
       setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post('http://localhost:5000/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Upload successful:', response.data);
        
        // Call success callback with actual data from backend
        if (onUploadSuccess) {
          onUploadSuccess({
            reportId: response.data.reportId,
            extractedData: response.data.extractedData,
            filename: response.data.fileInfo.originalName
          });
        }
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'Upload failed. Please try again.';
        setError(errorMessage);
        console.error('Upload error:', err);
      } finally {
        setUploading(false);
      }
     };

     return (
       <div className="upload-container">
         <h2>Upload CBC Report</h2>
         <p className="subtitle">Upload an image (JPEG, PNG) or PDF of your CBC report</p>

         {error && (
           <div className="error-message">
             {error}
           </div>
         )}

         <div
           className="upload-area"
           onDragOver={handleDragOver}
           onDrop={handleDrop}
         >
          <input
            type="file"
            id="file-upload"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" className="upload-label">
            {preview ? (
              <div className="preview-container">
                <img src={preview} alt="Preview" className="preview-image" />
                <p className="file-name">{file.name}</p>
              </div>
            ) : file ? (
              <div>
                <p className="file-icon">📄</p>
                <p className="file-name">{file.name}</p>
                <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <p className="upload-icon">📤</p>
                <p className="upload-text">Drag and drop your report here</p>
                <p className="upload-subtext">or</p>
                <p className="upload-link">Click to browse files</p>
                <p className="upload-hint">Supports: JPEG, PNG, PDF (Max 10MB)</p>
              </div>
            )}
          </label>
        </div>

        {file && (
          <div className="upload-actions">
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
                setError(null);
              }}
              className="btn-secondary"
              disabled={uploading}
            >
              Clear
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? (
                <>
                  <span className="spinner"></span>
                  Extracting via OCR...
                </>
              ) : (
                'Extract via OCR'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  export default UploadReport;