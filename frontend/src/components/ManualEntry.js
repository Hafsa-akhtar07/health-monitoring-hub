import React, { useState } from 'react';
import axios from 'axios';

function ManualEntry({ onDataSubmit }) {
  const [formData, setFormData] = useState({
    hemoglobin: '',
    rbc: '',
    wbc: '',
    platelets: '',
    hematocrit: '',
    mcv: '',
    mch: '',
    mchc: '',
    rdw: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value ? parseFloat(value) : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    const requiredFields = ['hemoglobin', 'rbc', 'wbc', 'platelets'];
    const missingFields = requiredFields.filter(field => !formData[field]);

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post('http://localhost:5000/api/reports', {
        cbcData: formData
      });

      console.log('Report saved:', response.data);
      
      if (onDataSubmit) {
        onDataSubmit({
          reportId: response.data.reportId,
          cbcData: response.data.cbcData
        });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save report.';
      setError(errorMessage);
      console.error('Save error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      hemoglobin: '',
      rbc: '',
      wbc: '',
      platelets: '',
      hematocrit: '',
      mcv: '',
      mch: '',
      mchc: '',
      rdw: ''
    });
    setError(null);
  };

  return (
    <div className="manual-entry-container">
      <h2>Manual Entry</h2>
      <p className="subtitle">Enter your CBC values manually</p>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="hemoglobin">
              Hemoglobin (g/dL) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="hemoglobin"
              name="hemoglobin"
              value={formData.hemoglobin}
              onChange={handleChange}
              step="0.1"
              required
              placeholder="12.0-15.5"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rbc">
              RBC (million cells/μL) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="rbc"
              name="rbc"
              value={formData.rbc}
              onChange={handleChange}
              step="0.1"
              required
              placeholder="4.0-5.0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="wbc">
              WBC (cells/μL) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="wbc"
              name="wbc"
              value={formData.wbc}
              onChange={handleChange}
              required
              placeholder="4000-11000"
            />
          </div>

          <div className="form-group">
            <label htmlFor="platelets">
              Platelets (cells/μL) <span className="required">*</span>
            </label>
            <input
              type="number"
              id="platelets"
              name="platelets"
              value={formData.platelets}
              onChange={handleChange}
              required
              placeholder="150000-450000"
            />
          </div>

          <div className="form-group">
            <label htmlFor="hematocrit">Hematocrit (%)</label>
            <input
              type="number"
              id="hematocrit"
              name="hematocrit"
              value={formData.hematocrit}
              onChange={handleChange}
              step="0.1"
              placeholder="36-46"
            />
          </div>

          <div className="form-group">
            <label htmlFor="mcv">MCV (fL)</label>
            <input
              type="number"
              id="mcv"
              name="mcv"
              value={formData.mcv}
              onChange={handleChange}
              step="0.1"
              placeholder="80-100"
            />
          </div>

          <div className="form-group">
            <label htmlFor="mch">MCH (pg)</label>
            <input
              type="number"
              id="mch"
              name="mch"
              value={formData.mch}
              onChange={handleChange}
              step="0.1"
              placeholder="27-31"
            />
          </div>

          <div className="form-group">
            <label htmlFor="mchc">MCHC (g/dL)</label>
            <input
              type="number"
              id="mchc"
              name="mchc"
              value={formData.mchc}
              onChange={handleChange}
              step="0.1"
              placeholder="32-36"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rdw">RDW (%)</label>
            <input
              type="number"
              id="rdw"
              name="rdw"
              value={formData.rdw}
              onChange={handleChange}
              step="0.1"
              placeholder="11.5-14.5"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary"
            disabled={submitting}
          >
            Clear
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save & Analyze'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ManualEntry;

