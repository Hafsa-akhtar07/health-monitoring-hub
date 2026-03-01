import React from 'react';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-logo">
            <span className="footer-logo-icon">🏥</span>
            <h3>Health Monitoring Hub</h3>
            <p>AI-Powered CBC Analysis Platform</p>
          </div>
          <div className="social-links">
            <a href="#" className="social-link" aria-label="Facebook">
              <span>📘</span>
            </a>
            <a href="#" className="social-link" aria-label="Twitter">
              <span>🐦</span>
            </a>
            <a href="#" className="social-link" aria-label="LinkedIn">
              <span>💼</span>
            </a>
            <a href="#" className="social-link" aria-label="Instagram">
              <span>📷</span>
            </a>
          </div>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Quick Links</h4>
          <ul className="footer-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#about">About Us</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Support</h4>
          <ul className="footer-links">
            <li><a href="#help">Help Center</a></li>
            <li><a href="#contact">Contact Us</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#tutorials">Tutorials</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Legal</h4>
          <ul className="footer-links">
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#terms">Terms of Service</a></li>
            <li><a href="#cookies">Cookie Policy</a></li>
            <li><a href="#disclaimer">Medical Disclaimer</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Contact</h4>
          <ul className="footer-contact">
            <li>
              <span className="contact-icon">📧</span>
              <span>support@healthmonitoringhub.com</span>
            </li>
            <li>
              <span className="contact-icon">📞</span>
              <span>+1 (555) 123-4567</span>
            </li>
            <li>
              <span className="contact-icon">📍</span>
              <span>123 Health Street, Medical City</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; {currentYear} Health Monitoring Hub. All rights reserved.</p>
          <p className="footer-note">
            ⚠️ This platform provides AI-assisted insights for educational purposes only. 
            Always consult with a qualified healthcare professional for medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

