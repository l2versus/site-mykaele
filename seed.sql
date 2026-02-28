-- Create users with hashed passwords
INSERT INTO "User" (id, email, password, name, phone, "cpfRg", address, role, avatar, balance, "createdAt", "updatedAt")
VALUES (
  'clm1r0000000000000000001',
  'mykaele@homespa.com',
  '$2a$10$L9AT9.pCafqajJVIB5bB..wX1F8rKvwFJP.A0g.NvfHjQCJY5hI.e',
  'Mykaele Procópio',
  '(85) 99908-6924',
  NULL,
  NULL,
  'ADMIN',
  NULL,
  0.0,
  datetime('now'),
  datetime('now')
);

INSERT INTO "User" (id, email, password, name, phone, "cpfRg", address, role, avatar, balance, "createdAt", "updatedAt")
VALUES (
  'clm1r0000000000000000002',
  'cliente@demo.com',
  '$2a$10$K7bI8d3F/bQ7q2nLmZp5OuKl9F5L2E3Y9z4H8q2K5T8D5X2N9s6',
  'Cliente Demo',
  '(85) 98888-0000',
  NULL,
  NULL,
  'PATIENT',
  NULL,
  0.0,
  datetime('now'),
  datetime('now')
);
