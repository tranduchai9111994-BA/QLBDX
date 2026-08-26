import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import api from '../api/axios';
import {
  AlertItem, CustomerPackage, DashboardInsights, DashboardStats, HourlyStats,
  ParkingRecord, ParkingSpot, VehicleStats,
} from '../types';
import { LONG_PARKING_HOURS } from '../utils/dashboardUtils';

const REFRESH_INTERVAL_MS = 90_000;

export type ZoneOccupancy = {
  name: string;
  available: number;
  occupied: number;
  maintenance: number;
  total: number;
  fillRate: number;
};

export interface MyShiftSummary {
  from: string;
  to: string;
  totalAmount: number;
  totalTransactions: number;
  byMethod: { method: string; label: string; totalAmount: number; totalTransactions: number }[];
}

/** Gom logic gọi API dashboard dùng chung cho OpsDashboard (nhân viên) và MgmtDashboard (quản trị). */
export function useDashboardData(isAdmin: boolean) {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [parkedRecords, setParkedRecords] = useState<ParkingRecord[]>([]);
  const [expiringPackages, setExpiringPackages] = useState<CustomerPackage[]>([]);
  const [zones, setZones] = useState<ZoneOccupancy[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [myShift, setMyShift] = useState<MyShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [parkedRes, spotsRes, packagesRes] = await Promise.all([
        api.get<ParkingRecord[]>('/parking', { params: { status: 'parked' } }),
        api.get<ParkingSpot[]>('/parking-spots'),
        api.get<CustomerPackage[]>('/customer-packages'),
      ]);

      setParkedRecords(parkedRes.data);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setExpiringPackages(
        packagesRes.data.filter((pkg) => {
          if (pkg.status !== 'active') return false;
          const endDate = new Date(pkg.endDate);
          const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7;
        })
      );

      const zoneMap = new Map<string, ZoneOccupancy>();
      spotsRes.data.forEach((spot) => {
        const zoneName = spot.zone?.name || 'Chưa phân khu';
        const existing = zoneMap.get(zoneName) || {
          name: zoneName, available: 0, occupied: 0, maintenance: 0, total: 0, fillRate: 0,
        };
        existing.total += 1;
        if (spot.status === 'available') existing.available += 1;
        else if (spot.status === 'occupied') existing.occupied += 1;
        else existing.maintenance += 1;
        zoneMap.set(zoneName, existing);
      });

      const zoneList = Array.from(zoneMap.values()).map((z) => ({
        ...z,
        fillRate: z.total > 0 ? Math.round(((z.total - z.available) / z.total) * 100) : 0,
      }));
      setZones(zoneList.sort((a, b) => b.fillRate - a.fillRate));

      if (isAdmin) {
        const toDate = new Date();
        const fromDate = new Date(toDate);
        fromDate.setDate(fromDate.getDate() - 30);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const [dashboard, vStats, hStats, alertsRes, insightsRes] = await Promise.all([
          api.get<DashboardStats>('/reports/dashboard'),
          api.get<VehicleStats[]>('/reports/vehicle-stats', { params: { fromDate: fmt(fromDate), toDate: fmt(toDate) } }),
          api.get<HourlyStats[]>('/reports/hourly-stats'),
          api.get<AlertItem[]>('/reports/alerts', { params: { longParkingHours: LONG_PARKING_HOURS } }),
          api.get<DashboardInsights>('/reports/insights'),
        ]);
        setData(dashboard.data);
        setVehicleStats(vStats.data);
        setHourlyStats(hStats.data);
        setAlerts(alertsRes.data);
        setInsights(insightsRes.data);
        setMyShift(null);
      } else {
        setData({
          currentlyParked: parkedRes.data.length,
          totalSpots: spotsRes.data.length,
          availableSpots: spotsRes.data.filter((s) => s.status === 'available').length,
          occupiedSpots: spotsRes.data.filter((s) => s.status === 'occupied').length,
          todayEntries: 0,
          todayRevenue: 0,
          monthRevenue: 0,
        });
        setVehicleStats([]);
        setHourlyStats([]);
        setAlerts([]);
        setInsights(null);
        const shiftRes = await api.get<MyShiftSummary>('/payments/my-shift');
        setMyShift(shiftRes.data);
      }

      setLastUpdated(new Date());
      setError(false);
    } catch {
      setError(true);
      if (!silent) message.error('Không tải được dữ liệu tổng quan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData(false);
    timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  return {
    data, vehicleStats, hourlyStats, parkedRecords, expiringPackages, zones,
    alerts, insights, myShift, loading, refreshing, lastUpdated, error, fetchData,
  };
}
