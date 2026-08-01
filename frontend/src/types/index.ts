// User & Authentication
export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Customer
export interface Customer {
  id: number;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  identityCard?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerForm {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  identityCard?: string;
}

// Vehicle Type
export interface VehicleType {
  id: number;
  name: string;
  description?: string;
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  createdAt: string;
}

export interface VehicleTypeForm {
  name: string;
  description?: string;
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
}

// Vehicle
export interface Vehicle {
  id: number;
  customerId: number;
  vehicleTypeId: number;
  licensePlate: string;
  brand?: string;
  model?: string;
  color?: string;
  parkingStatus?: 'parked' | 'outside';
  customer?: { fullName: string };
  vehicleType?: { name: string };
  createdAt: string;
  updatedAt: string;
}

export interface VehicleForm {
  customerId: number;
  vehicleTypeId: number;
  licensePlate: string;
  brand?: string;
  model?: string;
  color?: string;
}

// Parking Zone
export interface ParkingZone {
  id: number;
  name: string;
  description?: string;
  totalSpots: number;
  availableSpots?: number;
  occupiedSpots?: number;
  createdAt: string;
}

export interface ParkingZoneForm {
  name: string;
  description?: string;
}

// Parking Spot
export interface ParkingSpot {
  id: number;
  zoneId: number;
  spotNumber: string;
  spotType: 'standard' | 'vip' | 'disabled';
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  zone?: { name: string };
  createdAt?: string;
}

export interface ParkingSpotForm {
  zoneId: number;
  spotNumber: string;
  spotType?: 'standard' | 'vip' | 'disabled';
}

export interface ParkingSpotUpdateForm {
  spotType?: 'standard' | 'vip' | 'disabled';
  status?: 'available' | 'occupied' | 'reserved' | 'maintenance';
}

// Parking Package
export interface ParkingPackage {
  id: number;
  name: string;
  vehicleTypeId: number;
  durationDays: number;
  price: number;
  description?: string;
  isActive: boolean;
  vehicleType?: { name: string };
  createdAt: string;
}

export interface PackageForm {
  name: string;
  vehicleTypeId: number;
  durationDays: number;
  price: number;
  description?: string;
}

// Customer Package
export interface CustomerPackage {
  id: number;
  customerId: number;
  packageId: number;
  vehicleId: number;
  startDate: string;
  endDate: string;
  status: string;
  customer?: { fullName: string; phone?: string };
  parkingPackage?: { id?: number; name: string; price: number; vehicleTypeId?: number };
  vehicle?: { licensePlate: string };
  createdAt: string;
}

export interface CustomerPackageForm {
  customerId: number;
  packageId: number;
  vehicleId: number;
  startDate: any;
}

// Parking Record
export interface ParkingRecord {
  id: number;
  vehicleId?: number;
  licensePlate: string;
  vehicleTypeId: number;
  parkingSpotId?: number;
  entryTime: string;
  exitTime?: string;
  duration?: number;
  fee?: number;
  status: 'parked' | 'completed';
  notes?: string;
  vehicleType?: { name: string };
  parkingSpot?: { spotNumber: string; zone?: { name: string } };
  vehicle?: { brand?: string; model?: string; color?: string; customer?: { fullName: string } };
  createdAt: string;
}

export interface ParkingEntryForm {
  licensePlate: string;
  vehicleTypeId: number;
  parkingSpotId?: number;
  notes?: string;
}

export interface ParkingExitRequest {
  parkingRecordId: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
}

// Payment
export interface Payment {
  id: number;
  parkingRecordId?: number;
  customerPackageId?: number;
  amount: number;
  paymentMethod: string;
  paymentType: string;
  status: string;
  paidAt: string;
  createdBy?: number;
  notes?: string;
  creator?: { fullName: string };
  parkingRecord?: { licensePlate: string; entryTime: string; exitTime?: string };
  customerPackage?: { vehicle?: { licensePlate: string } };
}

// Dashboard Stats
export interface DashboardStats {
  currentlyParked: number;
  totalSpots: number;
  availableSpots: number;
  occupiedSpots: number;
  todayEntries: number;
  todayRevenue: number;
  monthRevenue: number;
}

// Revenue Report
export interface RevenueReport {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  parkingRevenue: number;
  packageRevenue: number;
}

// Vehicle Stats
export interface VehicleStats {
  vehicleType: string;
  totalRecords: number;
  totalFees: number;
}

// Hourly Stats
export interface HourlyStats {
  hour: number;
  count: number;
}

// User Form
export interface UserForm {
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  isActive?: boolean;
  password?: string;
}

// Customer Package check result
export interface PackageCheckResult {
  hasPackage: boolean;
  package: {
    id: number;
    endDate: string;
    parkingPackage?: { name: string } | null;
  } | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}

// Activity Log
export interface ActivityLog {
  id: number;
  userId?: number | null;
  username: string;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  details?: string | null;
  ipAddress?: string | null;
  statusCode?: number | null;
  createdAt: string;
  user?: { fullName: string } | null;
}

export interface ActivityLogPage {
  data: ActivityLog[];
  total: number;
  page: number;
  limit: number;
}

export interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  category: string;
  title: string;
  description: string;
  occurredAt: string;
  relatedPath?: string;
}
