-- PostgreSQL initialization script for development
-- This script runs automatically when the container is first created

-- Create test database
CREATE DATABASE uniformes_test;

-- Grant privileges to the application user
GRANT ALL PRIVILEGES ON DATABASE uniformes_test TO uniformes_user;

-- Connect to test database and grant schema privileges
\c uniformes_test
GRANT ALL ON SCHEMA public TO uniformes_user;
