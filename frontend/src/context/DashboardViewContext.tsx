/**
 * Ghi nhớ admin đang xem Tổng quan ở góc nhìn nào: "Quản lý" hay "Vận hành".
 *
 * Dùng Context vì nút chuyển đổi nằm ở thanh tiêu đề (MainLayout) nhưng nơi đọc giá trị lại là
 * trang Dashboard — hai component không có quan hệ cha con nên không truyền props được.
 */
import React, { createContext, useContext, useState } from 'react';

export type DashboardAdminView = 'mgmt' | 'ops';

interface DashboardViewContextValue {
  view: DashboardAdminView;
  setView: (v: DashboardAdminView) => void;
}

const DashboardViewContext = createContext<DashboardViewContextValue | undefined>(undefined);

const VIEW_STORAGE_KEY = 'dashboard-admin-view';

/**
 * Toggle "Quản lý / Vận hành" của trang Tổng quan đặt ở header (MainLayout) thay vì trong nội dung
 * trang — nhưng Dashboard.tsx (nội dung) và MainLayout (header) là 2 component tách rời qua <Outlet/>,
 * nên cần Context dùng chung thay vì state cục bộ để đổi ở header re-render đúng nội dung Dashboard.
 */
export const DashboardViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setViewState] = useState<DashboardAdminView>(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'ops' ? 'ops' : 'mgmt';
  });

  const setView = (v: DashboardAdminView) => {
    setViewState(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  return <DashboardViewContext.Provider value={{ view, setView }}>{children}</DashboardViewContext.Provider>;
};

export const useDashboardView = () => {
  const ctx = useContext(DashboardViewContext);
  if (!ctx) throw new Error('useDashboardView phải dùng bên trong DashboardViewProvider');
  return ctx;
};
