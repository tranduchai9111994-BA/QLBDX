-- Update admin password to: admin123
UPDATE Users 
SET PasswordHash = '$2a$10$Bs05VT1LKEsgQITT8qC2aejWgOckfkD9MfgDMtv5eIheiH2.Gm1j6'
WHERE Username = 'admin';
