   import React, { useState } from 'react';

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
         // TODO: Replace with actual API call
         // For now, simulate upload
         await new Promise(resolve => setTimeout(resolve, 2000));
         
         // Mock success response
         console.log('File uploaded:', file.name);
         
         // Call success callback if provided
         if (onUploadSuccess) {
           onUploadSuccess({
             filename: file.name,
             extractedValues: {
               hemoglobin: 12.5,
               rbc: 4.5,
               wbc: 7000,
               platelets: 250000
             }
           });
         }
       } catch (err) {
         setError('Upload failed. Please try again.');
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