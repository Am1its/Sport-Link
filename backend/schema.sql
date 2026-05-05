CREATE DATABASE IF NOT EXISTS sportlink CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportlink;

CREATE TABLE IF NOT EXISTS Users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Games (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  host_id         INT NOT NULL,
  sport_type      ENUM('basketball', 'tennis', 'volleyball', 'football') NOT NULL,
  level           TINYINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  latitude        DECIMAL(10, 8) NOT NULL,
  longitude       DECIMAL(11, 8) NOT NULL,
  location_desc   VARCHAR(255),
  scheduled_time  VARCHAR(100),
  equipment_notes TEXT,
  max_players     INT,
  status          ENUM('active', 'cancelled', 'completed') DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES Users(id) ON DELETE CASCADE
);
