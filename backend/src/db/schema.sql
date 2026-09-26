-- =============================================================
--  AutoPuja GT - Esquema de base de datos (SQL Server / Azure SQL)
--  Idempotente: se puede ejecutar varias veces sin error.
--  Las fechas se guardan en UTC.
-- =============================================================

IF OBJECT_ID('dbo.Users') IS NULL
CREATE TABLE dbo.Users (
  Id            INT IDENTITY(1,1) CONSTRAINT PK_Users PRIMARY KEY,
  FirstName     NVARCHAR(80)  NOT NULL,
  LastName      NVARCHAR(80)  NOT NULL,
  Email         NVARCHAR(160) NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
  Phone         NVARCHAR(30)  NOT NULL,
  PasswordHash  NVARCHAR(200) NOT NULL,
  CreatedAt     DATETIME2     NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

-- ---------- Catálogos ----------
IF OBJECT_ID('dbo.Brands') IS NULL
CREATE TABLE dbo.Brands (
  Id   INT IDENTITY(1,1) CONSTRAINT PK_Brands PRIMARY KEY,
  Name NVARCHAR(60) NOT NULL CONSTRAINT UQ_Brands_Name UNIQUE
);
GO
IF OBJECT_ID('dbo.ItemTypes') IS NULL
CREATE TABLE dbo.ItemTypes (
  Id   INT IDENTITY(1,1) CONSTRAINT PK_ItemTypes PRIMARY KEY,
  Name NVARCHAR(60) NOT NULL CONSTRAINT UQ_ItemTypes_Name UNIQUE,
  Body NVARCHAR(20) NOT NULL -- silueta usada para ilustraciones demo
);
GO
IF OBJECT_ID('dbo.FuelTypes') IS NULL
CREATE TABLE dbo.FuelTypes (
  Id   INT IDENTITY(1,1) CONSTRAINT PK_FuelTypes PRIMARY KEY,
  Name NVARCHAR(40) NOT NULL CONSTRAINT UQ_FuelTypes_Name UNIQUE
);
GO
IF OBJECT_ID('dbo.Transmissions') IS NULL
CREATE TABLE dbo.Transmissions (
  Id   INT IDENTITY(1,1) CONSTRAINT PK_Transmissions PRIMARY KEY,
  Name NVARCHAR(40) NOT NULL CONSTRAINT UQ_Transmissions_Name UNIQUE
);
GO
IF OBJECT_ID('dbo.DriveTrains') IS NULL
CREATE TABLE dbo.DriveTrains (
  Id   INT IDENTITY(1,1) CONSTRAINT PK_DriveTrains PRIMARY KEY,
  Code NVARCHAR(5)  NOT NULL CONSTRAINT UQ_DriveTrains_Code UNIQUE,
  Name NVARCHAR(60) NOT NULL
);
GO
IF OBJECT_ID('dbo.DamageLevels') IS NULL
CREATE TABLE dbo.DamageLevels (
  Id          INT IDENTITY(1,1) CONSTRAINT PK_DamageLevels PRIMARY KEY,
  Code        NVARCHAR(10) NOT NULL CONSTRAINT UQ_DamageLevels_Code UNIQUE, -- VERDE | AMARILLO | ROJO
  Name        NVARCHAR(20) NOT NULL,
  Description NVARCHAR(80) NOT NULL,
  Color       NVARCHAR(9)  NOT NULL
);
GO

-- ---------- Vehículos / subastas ----------
IF OBJECT_ID('dbo.Vehicles') IS NULL
CREATE TABLE dbo.Vehicles (
  Id              INT IDENTITY(1,1) CONSTRAINT PK_Vehicles PRIMARY KEY,
  SellerId        INT           NOT NULL CONSTRAINT FK_Vehicles_Seller REFERENCES dbo.Users(Id),
  [Year]          SMALLINT      NOT NULL,
  ItemTypeId      INT           NOT NULL CONSTRAINT FK_Vehicles_ItemType REFERENCES dbo.ItemTypes(Id),
  BrandId         INT           NOT NULL CONSTRAINT FK_Vehicles_Brand REFERENCES dbo.Brands(Id),
  Model           NVARCHAR(80)  NOT NULL,
  Engine          NVARCHAR(80)  NOT NULL,
  TransmissionId  INT           NOT NULL CONSTRAINT FK_Vehicles_Transmission REFERENCES dbo.Transmissions(Id),
  FuelTypeId      INT           NOT NULL CONSTRAINT FK_Vehicles_FuelType REFERENCES dbo.FuelTypes(Id),
  DriveTrainId    INT           NOT NULL CONSTRAINT FK_Vehicles_DriveTrain REFERENCES dbo.DriveTrains(Id),
  Cylinders       TINYINT       NOT NULL,
  DamageLevelId   INT           NOT NULL CONSTRAINT FK_Vehicles_DamageLevel REFERENCES dbo.DamageLevels(Id),
  Color           NVARCHAR(40)  NULL,
  Mileage         INT           NULL,
  Description     NVARCHAR(2000) NULL,
  BasePrice       DECIMAL(14,2) NOT NULL,
  StartAt         DATETIME2     NOT NULL,
  EndAt           DATETIME2     NOT NULL,
  CurrentBid      DECIMAL(14,2) NULL,
  CurrentBidderId INT           NULL CONSTRAINT FK_Vehicles_CurrentBidder REFERENCES dbo.Users(Id),
  BidCount        INT           NOT NULL CONSTRAINT DF_Vehicles_BidCount DEFAULT 0,
  Status          NVARCHAR(12)  NOT NULL CONSTRAINT DF_Vehicles_Status DEFAULT 'ABIERTA', -- ABIERTA | VENDIDA | DESIERTA
  ClosedAt        DATETIME2     NULL,
  CreatedAt       DATETIME2     NOT NULL CONSTRAINT DF_Vehicles_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt       DATETIME2     NOT NULL CONSTRAINT DF_Vehicles_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Vehicles_Dates CHECK (EndAt > StartAt),
  CONSTRAINT CK_Vehicles_BasePrice CHECK (BasePrice > 0),
  CONSTRAINT CK_Vehicles_Cylinders CHECK (Cylinders BETWEEN 0 AND 16)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vehicles_Open_EndAt')
  CREATE INDEX IX_Vehicles_Open_EndAt ON dbo.Vehicles (EndAt) WHERE ClosedAt IS NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vehicles_Seller')
  CREATE INDEX IX_Vehicles_Seller ON dbo.Vehicles (SellerId);
GO

IF OBJECT_ID('dbo.VehicleImages') IS NULL
CREATE TABLE dbo.VehicleImages (
  Id          INT IDENTITY(1,1) CONSTRAINT PK_VehicleImages PRIMARY KEY,
  VehicleId   INT            NOT NULL CONSTRAINT FK_VehicleImages_Vehicle REFERENCES dbo.Vehicles(Id) ON DELETE CASCADE,
  SortOrder   INT            NOT NULL,
  ContentType NVARCHAR(40)   NOT NULL,
  Data        VARBINARY(MAX) NOT NULL,
  CreatedAt   DATETIME2      NOT NULL CONSTRAINT DF_VehicleImages_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VehicleImages_Vehicle')
  CREATE INDEX IX_VehicleImages_Vehicle ON dbo.VehicleImages (VehicleId, SortOrder);
GO

IF OBJECT_ID('dbo.Bids') IS NULL
CREATE TABLE dbo.Bids (
  Id        BIGINT IDENTITY(1,1) CONSTRAINT PK_Bids PRIMARY KEY,
  VehicleId INT           NOT NULL CONSTRAINT FK_Bids_Vehicle REFERENCES dbo.Vehicles(Id) ON DELETE CASCADE,
  UserId    INT           NOT NULL CONSTRAINT FK_Bids_User REFERENCES dbo.Users(Id),
  Amount    DECIMAL(14,2) NOT NULL,
  CreatedAt DATETIME2     NOT NULL CONSTRAINT DF_Bids_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bids_Vehicle')
  CREATE INDEX IX_Bids_Vehicle ON dbo.Bids (VehicleId, Amount DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bids_User')
  CREATE INDEX IX_Bids_User ON dbo.Bids (UserId, VehicleId);
GO

-- ---------- Datos de catálogos ----------
IF NOT EXISTS (SELECT 1 FROM dbo.DamageLevels)
INSERT INTO dbo.DamageLevels (Code, Name, Description, Color) VALUES
  (N'VERDE',    N'Verde',    N'Daño menor / Limpio',       N'#22C55E'),
  (N'AMARILLO', N'Amarillo', N'Daño medio / Reparable',    N'#F5A524'),
  (N'ROJO',     N'Rojo',     N'Daño severo / Salvamento',  N'#EF4444');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.DriveTrains)
INSERT INTO dbo.DriveTrains (Code, Name) VALUES
  (N'FWD', N'Tracción delantera (FWD)'),
  (N'RWD', N'Tracción trasera (RWD)'),
  (N'AWD', N'Tracción integral (AWD)'),
  (N'4WD', N'Doble tracción (4WD)');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Transmissions)
INSERT INTO dbo.Transmissions (Name) VALUES
  (N'Automática'), (N'Manual'), (N'CVT'), (N'Doble embrague (DCT)');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.FuelTypes)
INSERT INTO dbo.FuelTypes (Name) VALUES
  (N'Gasolina'), (N'Diésel'), (N'Híbrido'), (N'Eléctrico'), (N'Gas (GLP)');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ItemTypes)
INSERT INTO dbo.ItemTypes (Name, Body) VALUES
  (N'Sedán', N'sedan'), (N'SUV', N'suv'), (N'Pickup', N'pickup'), (N'Hatchback', N'hatch'),
  (N'Coupé', N'coupe'), (N'Van / Minivan', N'van'), (N'Camión', N'truck'), (N'Motocicleta', N'moto');
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Brands)
INSERT INTO dbo.Brands (Name) VALUES
  (N'Audi'), (N'BMW'), (N'Chevrolet'), (N'Dodge'), (N'Ford'), (N'GMC'), (N'Honda'), (N'Hyundai'),
  (N'Isuzu'), (N'Jeep'), (N'Kawasaki'), (N'Kia'), (N'Lexus'), (N'Mazda'), (N'Mercedes-Benz'),
  (N'Mitsubishi'), (N'Nissan'), (N'RAM'), (N'Subaru'), (N'Suzuki'), (N'Tesla'), (N'Toyota'),
  (N'Volkswagen'), (N'Yamaha');
GO
