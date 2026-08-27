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

export interface ScheduleRateChangeForm {
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  effectiveFrom: any;
}

export interface RateHistoryEntry {
  id: number;
  vehicleTypeId: number;
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  effectiveFrom: string;
  changedBy?: number | null;
  createdAt: string;
  changer?: { fullName: string } | null;
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

export interface SchedulePriceChangeForm {
  price: number;
  effectiveFrom: any;
}

export interface PriceHistoryEntry {
  id: number;
  packageId: number;
  price: number;
  effectiveFrom: string;
  changedBy?: number | null;
  createdAt: string;
  changer?: { fullName: string } | null;
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
  endDate?: any;
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
  vehicle?: { brand?: string; model?: string; color?: string; customer?: { id?: number; fullName: string } };
  createdAt: string;
}

export interface ParkingEntryForm {
  licensePlate: string;
  vehicleTypeId: number;
  parkingSpotId?: number;
  notes?: string;
}

// Smart lookup (auto-fill thông minh khi nhập biển số)
export interface SmartLookupInsights {
  visitCount30Days: number;
  lastVisit: string | null;
  avgDurationHours: number | null;
  preferredZone: string | null;
  hasActivePackage: boolean;
  packageName: string | null;
  packageExpiry: string | null;
  isFrequent: boolean;
  suggestedSpotId: number | null;
  suggestedSpotLabel: string | null;
  suggestedSpotNote: string | null;
}

export interface SmartLookupResult {
  vehicle: Vehicle | null;
  customer: { fullName: string; phone?: string } | null;
  insights: SmartLookupInsights | null;
}

export interface ParkingExitRequest {
  parkingRecordId: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
}

export interface ParkingExitExceptionRequest {
  parkingRecordId: number;
  paymentMethod?: 'cash' | 'card' | 'transfer';
  exceptionReason: 'lost_ticket' | 'damaged_ticket' | 'force_release' | 'fee_waiver' | 'other';
  exceptionNote: string;
  waiveFee?: boolean;
  overrideFee?: number | null;
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

// Dashboard insights (DSS — so sánh tuần, xu hướng, gợi ý)
export interface DashboardInsights {
  weekComparison: {
    thisWeek: { revenue: number; vehicles: number; avgDuration: number };
    lastWeek: { revenue: number; vehicles: number; avgDuration: number };
    changePercent: { revenue: number; vehicles: number; avgDuration: number };
  };
  peakHours: {
    morning: { hour: number; avgCount: number };
    afternoon: { hour: number; avgCount: number };
  };
  dailyTrend: { date: string; vehicles: number; revenue: number }[];
  topVehicleTypes: { type: string; count: number; percent: number }[];
  suggestions: { type: string; message: string }[];
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

export interface PaymentMethodStat {
  method: string;
  label: string;
  totalAmount: number;
  totalTransactions: number;
}

export interface PaymentTypeStat {
  type: string;
  label: string;
  totalAmount: number;
  totalTransactions: number;
}

export interface PaymentMethodReport {
  byMethod: PaymentMethodStat[];
  byType: PaymentTypeStat[];
  totalAmount: number;
  totalTransactions: number;
}

export interface ExceptionReasonStat {
  key: string;
  label: string;
  count: number;
  totalFeeWaived: number;
}

export interface ExceptionRecord {
  id: number;
  licensePlate: string;
  vehicleType: string;
  entryTime: string;
  exitTime: string | null;
  fee: number;
  reasonKey: string;
  reasonLabel: string;
  staffName: string;
  notes: string;
}

export interface ExceptionStats {
  totalCount: number;
  totalFeeImpact: number;
  waivedCount: number;
  byReason: ExceptionReasonStat[];
  records: ExceptionRecord[];
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

// Analytics — Phân tích & Gợi ý quyết định (DSS)
export interface AnalyticsDecisionOption {
  action: string;
  estimatedImpact: string;
  risk: string;
}
export interface AnalyticsDecision {
  id: string;
  question: string;
  analysis: string;
  options: AnalyticsDecisionOption[];
}
export interface AnalyticsInsights {
  period: string;
  summary: {
    totalRevenue: number;
    totalVehicles: number;
    avgRevenuePerDay: number;
    avgVehiclesPerDay: number;
    occupancyRate: number;
  };
  dayOfWeekAnalysis: { day: string; avgVehicles: number; avgRevenue: number }[];
  hourlyAnalysis: { hour: number; avgVehicles: number }[];
  zoneEfficiency: { zone: string; totalSpots: number; avgOccupancy: number; revenue: number; revenuePerSpot: number }[];
  decisions: AnalyticsDecision[];
}

export interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  category: string;
  title: string;
  description: string;
  occurredAt: string;
  relatedPath?: string;
  smartLevel?: 'rule_based';
  context?: Record<string, string | number>;
  suggestedAction?: string;
}
