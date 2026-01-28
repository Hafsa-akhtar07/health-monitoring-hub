import React, { useState } from 'react';

function Profile({ onNavigate }) {
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    age: '',
    gender: '',
    bloodGroup: '',
    email: 'john.doe@example.com'
  });
  const [dataAnonymization, setDataAnonymization] = useState(false);
  const [shareWithDoctor, setShareWithDoctor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    // Simulate API call
    setTimeout(() => {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setSaving(false);
    }, 1000);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      // Handle logout logic
      console.log('Logging out...');
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // Handle account deletion
      console.log('Deleting account...');
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>Profile & Privacy Settings</h2>
        <p className="profile-subtitle">Manage your personal information and data privacy</p>
      </div>

      <div className="profile-content">
        {/* Personal Information */}
        <div className="profile-section">
          <h3>Personal Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={profileData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={profileData.email}
                onChange={handleInputChange}
                disabled
                className="disabled-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="age">Age</label>
              <input
                type="number"
                id="age"
                name="age"
                value={profileData.age}
                onChange={handleInputChange}
                placeholder="Enter your age"
                min="1"
                max="120"
              />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={profileData.gender}
                onChange={handleInputChange}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="bloodGroup">Blood Group</label>
              <select
                id="bloodGroup"
                name="bloodGroup"
                value={profileData.bloodGroup}
                onChange={handleInputChange}
              >
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {message && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Data Privacy Settings */}
        <div className="profile-section">
          <h3>Data Privacy & Security</h3>
          
          <div className="privacy-toggle">
            <div className="toggle-item">
              <div className="toggle-info">
                <h4>Data Anonymization</h4>
                <p>Anonymize your health data for research purposes while maintaining privacy</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={dataAnonymization}
                  onChange={(e) => setDataAnonymization(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <h4>Share with Doctor</h4>
                <p>Allow your healthcare provider to access your reports for consultation</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={shareWithDoctor}
                  onChange={(e) => setShareWithDoctor(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="data-storage-info">
            <h4>Data Storage Information</h4>
            <div className="storage-details">
              <p><strong>Storage Location:</strong> Secure cloud servers with encryption</p>
              <p><strong>Data Retention:</strong> Your data is stored securely and can be deleted upon request</p>
              <p><strong>Compliance:</strong> All data handling complies with healthcare privacy regulations</p>
            </div>
          </div>

          <button className="btn-secondary" onClick={() => window.alert('Doctor sharing management coming soon')}>
            Manage Data Sharing with Doctor
          </button>
        </div>

        {/* Account Actions */}
        <div className="profile-section">
          <h3>Account Actions</h3>
          <div className="account-actions">
            <button className="btn-secondary" onClick={handleLogout}>
              Logout
            </button>
            <button className="btn-danger" onClick={handleDeleteAccount}>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;

