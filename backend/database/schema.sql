-- Health Monitoring Hub Database Schema
-- Run this script to create the database tables manually if needed

-- Create database (run this separately)
-- CREATE DATABASE health_monitoring_hub;

-- Connect to database
-- \c health_monitoring_hub;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    filename VARCHAR(255),
    file_path VARCHAR(500),
    extracted_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analyses table
CREATE TABLE IF NOT EXISTS analyses (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES reports(id) ON DELETE CASCADE,
    rule_based_results JSONB,
    ml_results JSONB,
    severity VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_analyses_report_id ON analyses(report_id);
CREATE INDEX IF NOT EXISTS idx_analyses_severity ON analyses(severity);

-- Insert sample data (optional, for testing)
-- INSERT INTO users (email, name) VALUES ('test@example.com', 'Test User');
-- INSERT INTO reports (user_id, extracted_data) 
-- VALUES (1, '{"hemoglobin": 12.5, "rbc": 4.5, "wbc": 7000, "platelets": 250000}');

