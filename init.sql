-- Mykaele Home Spa - Inicialização do Banco de Dados SQLite
-- Gerado a partir do schema.prisma

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "cpfRg" TEXT,
    "address" TEXT,
    "addressCep" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComp" TEXT,
    "addressNeighborhood" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressLat" REAL,
    "addressLng" REAL,
    "googleId" TEXT,
    "instagramId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'PATIENT',
    "avatar" TEXT,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_instagramId_key" ON "User"("instagramId");

CREATE TABLE IF NOT EXISTS "Service" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "price" REAL NOT NULL,
    "priceReturn" REAL,
    "active" INTEGER NOT NULL DEFAULT 1,
    "isAddon" INTEGER NOT NULL DEFAULT 0,
    "travelFee" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Service_name_key" ON "Service"("name");

CREATE TABLE IF NOT EXISTS "PackageOption" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Package" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "packageOptionId" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "usedSessions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("packageOptionId") REFERENCES "PackageOption"("id")
);
CREATE INDEX IF NOT EXISTS "Package_userId_idx" ON "Package"("userId");
CREATE INDEX IF NOT EXISTS "Package_status_idx" ON "Package"("status");
CREATE INDEX IF NOT EXISTS "Package_packageOptionId_idx" ON "Package"("packageOptionId");

CREATE TABLE IF NOT EXISTS "Appointment" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FIRST',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "location" TEXT NOT NULL DEFAULT 'HOME_SPA',
    "address" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" DATETIME,
    "addons" TEXT,
    "travelFee" REAL NOT NULL DEFAULT 0,
    "price" REAL NOT NULL DEFAULT 0,
    "paidFromBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
);
CREATE INDEX IF NOT EXISTS "Appointment_userId_idx" ON "Appointment"("userId");
CREATE INDEX IF NOT EXISTS "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");

CREATE TABLE IF NOT EXISTS "Schedule" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 60,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "active" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS "Schedule_dayOfWeek_key" ON "Schedule"("dayOfWeek");

CREATE TABLE IF NOT EXISTS "BlockedDate" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "date" DATETIME NOT NULL,
    "reason" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "BlockedDate_date_key" ON "BlockedDate"("date");

CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "category" TEXT NOT NULL DEFAULT 'REVENUE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_category_idx" ON "Payment"("category");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");

CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category");
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");

CREATE TABLE IF NOT EXISTS "BodyMeasurement" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" REAL,
    "height" REAL,
    "bodyFat" REAL,
    "muscleMass" REAL,
    "bmi" REAL,
    "bust" REAL,
    "waist" REAL,
    "abdomen" REAL,
    "hip" REAL,
    "armLeft" REAL,
    "armRight" REAL,
    "thighLeft" REAL,
    "thighRight" REAL,
    "calfLeft" REAL,
    "calfRight" REAL,
    "goalWeight" REAL,
    "goalWaist" REAL,
    "goalHip" REAL,
    "goalBodyFat" REAL,
    "notes" TEXT,
    "measuredBy" TEXT,
    "sessionId" TEXT,
    "photoFront" TEXT,
    "photoSide" TEXT,
    "photoBack" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BodyMeasurement_userId_idx" ON "BodyMeasurement"("userId");
CREATE INDEX IF NOT EXISTS "BodyMeasurement_date_idx" ON "BodyMeasurement"("date");

CREATE TABLE IF NOT EXISTS "SessionFeedback" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "categories" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "SessionFeedback_appointmentId_key" ON "SessionFeedback"("appointmentId");
CREATE INDEX IF NOT EXISTS "SessionFeedback_userId_idx" ON "SessionFeedback"("userId");

CREATE TABLE IF NOT EXISTS "CareGuideline" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timing" TEXT NOT NULL DEFAULT '24h',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "Anamnese" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "birthDate" TEXT,
    "gender" TEXT,
    "bloodType" TEXT,
    "weight" REAL,
    "height" REAL,
    "occupation" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "chronicConditions" TEXT,
    "surgeries" TEXT,
    "healthNotes" TEXT,
    "hasAllergies" INTEGER NOT NULL DEFAULT 0,
    "hasDiabetes" INTEGER NOT NULL DEFAULT 0,
    "hasHypertension" INTEGER NOT NULL DEFAULT 0,
    "hasHeartCondition" INTEGER NOT NULL DEFAULT 0,
    "hasCirculatory" INTEGER NOT NULL DEFAULT 0,
    "hasProsthetics" INTEGER NOT NULL DEFAULT 0,
    "hasThyroid" INTEGER NOT NULL DEFAULT 0,
    "isPregnant" INTEGER NOT NULL DEFAULT 0,
    "isBreastfeeding" INTEGER NOT NULL DEFAULT 0,
    "hasSkinSensitivity" INTEGER NOT NULL DEFAULT 0,
    "hasVaricoseVeins" INTEGER NOT NULL DEFAULT 0,
    "hasRecentSurgery" INTEGER NOT NULL DEFAULT 0,
    "smokingStatus" TEXT,
    "alcoholUse" TEXT,
    "exerciseLevel" TEXT,
    "sleepQuality" TEXT,
    "waterIntake" TEXT,
    "dietDescription" TEXT,
    "mainGoals" TEXT,
    "bodyAreas" TEXT,
    "previousTreatments" TEXT,
    "expectations" TEXT,
    "consentGiven" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Anamnese_userId_key" ON "Anamnese"("userId");
