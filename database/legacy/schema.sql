-- =============================================
-- PARKING MANAGEMENT SYSTEM - DATABASE SCHEMA
-- SQL Server
-- =============================================

CREATE DATABASE ParkingManagement;
GO

USE ParkingManagement;
GO

-- =============================================
-- 1. Users (system users: admin, staff)
-- =============================================
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100),
    Phone NVARCHAR(20),
    Role NVARCHAR(20) NOT NULL DEFAULT 'staff', -- admin, staff
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

-- =============================================
-- 2. Customers
-- =============================================
CREATE TABLE Customers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Phone NVARCHAR(20) NOT NULL,
    Email NVARCHAR(100),
    Address NVARCHAR(255),
    IdentityCard NVARCHAR(20),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

-- =============================================
-- 3. Vehicle Types
-- =============================================
CREATE TABLE VehicleTypes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL,           -- Xe máy, Ô tô, Xe tải...
    Description NVARCHAR(200),
    HourlyRate DECIMAL(10,2) NOT NULL,     -- Giá theo giờ
    DailyRate DECIMAL(10,2) NOT NULL,      -- Giá theo ngày
    MonthlyRate DECIMAL(10,2) NOT NULL,    -- Giá theo tháng
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

-- =============================================
-- 4. Vehicles
-- =============================================
CREATE TABLE Vehicles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    VehicleTypeId INT NOT NULL,
    LicensePlate NVARCHAR(20) NOT NULL UNIQUE,
    Brand NVARCHAR(50),
    Model NVARCHAR(50),
    Color NVARCHAR(30),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
    FOREIGN KEY (VehicleTypeId) REFERENCES VehicleTypes(Id)
);

-- =============================================
-- 5. Parking Zones
-- =============================================
CREATE TABLE ParkingZones (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL,           -- Khu A, Khu B...
    Description NVARCHAR(200),
    TotalSpots INT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

-- =============================================
-- 6. Parking Spots
-- =============================================
CREATE TABLE ParkingSpots (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ZoneId INT NOT NULL,
    SpotNumber NVARCHAR(10) NOT NULL,      -- A01, A02, B01...
    SpotType NVARCHAR(20) NOT NULL DEFAULT 'standard', -- standard, vip, disabled
    Status NVARCHAR(20) NOT NULL DEFAULT 'available', -- available, occupied, reserved, maintenance
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (ZoneId) REFERENCES ParkingZones(Id),
    UNIQUE (ZoneId, SpotNumber)
);

-- =============================================
-- 7. Parking Packages (Vé tháng, vé quý, vé năm)
-- =============================================
CREATE TABLE ParkingPackages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    VehicleTypeId INT NOT NULL,
    DurationDays INT NOT NULL,             -- 30, 90, 365...
    Price DECIMAL(10,2) NOT NULL,
    Description NVARCHAR(500),
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (VehicleTypeId) REFERENCES VehicleTypes(Id)
);

-- =============================================
-- 8. Customer Packages (Đăng ký gói)
-- =============================================
CREATE TABLE CustomerPackages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    PackageId INT NOT NULL,
    VehicleId INT NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'active', -- active, expired, cancelled
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customers(Id),
    FOREIGN KEY (PackageId) REFERENCES ParkingPackages(Id),
    FOREIGN KEY (VehicleId) REFERENCES Vehicles(Id)
);

-- =============================================
-- 9. Parking Records (Ghi nhận xe ra vào)
-- =============================================
CREATE TABLE ParkingRecords (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    VehicleId INT,
    LicensePlate NVARCHAR(20) NOT NULL,
    VehicleTypeId INT NOT NULL,
    ParkingSpotId INT,
    EntryTime DATETIME NOT NULL DEFAULT GETDATE(),
    ExitTime DATETIME,
    Duration INT,                          -- Duration in minutes
    Fee DECIMAL(10,2),
    Status NVARCHAR(20) NOT NULL DEFAULT 'parked', -- parked, completed
    Notes NVARCHAR(500),
    CreatedBy INT,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (VehicleId) REFERENCES Vehicles(Id),
    FOREIGN KEY (VehicleTypeId) REFERENCES VehicleTypes(Id),
    FOREIGN KEY (ParkingSpotId) REFERENCES ParkingSpots(Id),
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

-- =============================================
-- 10. Payments (Thanh toán)
-- =============================================
CREATE TABLE Payments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ParkingRecordId INT,
    CustomerPackageId INT,
    Amount DECIMAL(10,2) NOT NULL,
    PaymentMethod NVARCHAR(30) NOT NULL DEFAULT 'cash', -- cash, card, transfer
    PaymentType NVARCHAR(30) NOT NULL DEFAULT 'parking', -- parking, package
    Status NVARCHAR(20) NOT NULL DEFAULT 'completed', -- completed, pending, refunded
    PaidAt DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy INT,
    Notes NVARCHAR(500),
    FOREIGN KEY (ParkingRecordId) REFERENCES ParkingRecords(Id),
    FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(Id),
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

-- =============================================
-- 11. User Activity Logs (Nhật ký hoạt động)
-- =============================================
CREATE TABLE UserActivityLogs (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT,                             -- NULL = chưa đăng nhập (đăng nhập thất bại)
    Username NVARCHAR(50) NOT NULL,
    Action NVARCHAR(30) NOT NULL,           -- LOGIN, LOGIN_FAILED, LOGOUT, CREATE, UPDATE, DELETE
    Entity NVARCHAR(50),                    -- Users, Customers, Vehicles, ParkingRecords...
    EntityId INT,                           -- ID bản ghi bị tác động
    Details NVARCHAR(1000),                 -- Thông tin bổ sung (JSON)
    IpAddress NVARCHAR(50),
    StatusCode INT,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- =============================================
-- SEED DATA
-- =============================================

-- Default admin user (password: admin123)
INSERT INTO Users (Username, PasswordHash, FullName, Email, Role)
VALUES ('admin', '$2a$10$Bs05VT1LKEsgQITT8qC2aejWgOckfkD9MfgDMtv5eIheiH2.Gm1j6', N'Quản trị viên', 'admin@parking.com', 'admin');

-- Vehicle Types
INSERT INTO VehicleTypes (Name, Description, HourlyRate, DailyRate, MonthlyRate) VALUES
(N'Xe máy', N'Xe máy, xe gắn máy', 5000, 20000, 200000),
(N'Ô tô con', N'Ô tô dưới 9 chỗ', 20000, 100000, 1500000),
(N'Ô tô lớn', N'Ô tô từ 9 chỗ trở lên, xe tải', 30000, 150000, 2500000),
(N'Xe đạp', N'Xe đạp các loại', 2000, 10000, 100000);

-- Parking Zones
INSERT INTO ParkingZones (Name, Description, TotalSpots) VALUES
(N'Khu A', N'Khu vực xe máy', 50),
(N'Khu B', N'Khu vực ô tô con', 30),
(N'Khu C', N'Khu vực ô tô lớn', 20),
(N'Khu D', N'Khu vực VIP', 10);

-- Parking Spots - Zone A (Motorbikes)
DECLARE @i INT = 1;
WHILE @i <= 50
BEGIN
    INSERT INTO ParkingSpots (ZoneId, SpotNumber, SpotType)
    VALUES (1, 'A' + RIGHT('00' + CAST(@i AS VARCHAR), 2), 'standard');
    SET @i = @i + 1;
END

-- Parking Spots - Zone B (Cars)
SET @i = 1;
WHILE @i <= 30
BEGIN
    INSERT INTO ParkingSpots (ZoneId, SpotNumber, SpotType)
    VALUES (2, 'B' + RIGHT('00' + CAST(@i AS VARCHAR), 2), 'standard');
    SET @i = @i + 1;
END

-- Parking Spots - Zone C (Large vehicles)
SET @i = 1;
WHILE @i <= 20
BEGIN
    INSERT INTO ParkingSpots (ZoneId, SpotNumber, SpotType)
    VALUES (3, 'C' + RIGHT('00' + CAST(@i AS VARCHAR), 2), 'standard');
    SET @i = @i + 1;
END

-- Parking Spots - Zone D (VIP)
SET @i = 1;
WHILE @i <= 10
BEGIN
    INSERT INTO ParkingSpots (ZoneId, SpotNumber, SpotType)
    VALUES (4, 'D' + RIGHT('00' + CAST(@i AS VARCHAR), 2), 'vip');
    SET @i = @i + 1;
END

-- Parking Packages
INSERT INTO ParkingPackages (Name, VehicleTypeId, DurationDays, Price, Description) VALUES
(N'Vé tháng xe máy', 1, 30, 200000, N'Gói gửi xe máy theo tháng'),
(N'Vé quý xe máy', 1, 90, 550000, N'Gói gửi xe máy theo quý'),
(N'Vé năm xe máy', 1, 365, 2000000, N'Gói gửi xe máy theo năm'),
(N'Vé tháng ô tô con', 2, 30, 1500000, N'Gói gửi ô tô con theo tháng'),
(N'Vé quý ô tô con', 2, 90, 4000000, N'Gói gửi ô tô con theo quý'),
(N'Vé năm ô tô con', 2, 365, 15000000, N'Gói gửi ô tô con theo năm'),
(N'Vé tháng ô tô lớn', 3, 30, 2500000, N'Gói gửi ô tô lớn theo tháng');

GO
