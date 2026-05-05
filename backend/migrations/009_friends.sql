CREATE TABLE Friends (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  requester_id  INT NOT NULL,
  addressee_id  INT NOT NULL,
  status        ENUM('pending','accepted') DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_request (requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES Users(id) ON DELETE CASCADE
);
