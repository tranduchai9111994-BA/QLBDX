/**
 * permConfig.ts
 * Quản lý cấu hình phân quyền màn hình cho từng vai trò.
 * Admin luôn thấy toàn bộ (không thay đổi được).
 * Staff: các màn hình "configurable: true" có thể bật/tắt bởi Admin.
 * Config được lưu vào localStorage, MainLayout đọc khi render menu.
 */

export type AccessLevel = 'full' | 'view' | 'hidden';

export interface ScreenDef {
  key: string;               // route key (dùng làm ID)
  label: string;             // tên hiển thị
  group: string;             // nhóm menu
  adminLevel: AccessLevel;   // quyền admin (luôn 'full')
  defaultStaffLevel: AccessLevel; // mặc định cho staff
  configurable: boolean;     // admin có thể thay đổi cho staff
}

export const SCREENS: ScreenDef[] = [
  { key: 'dashboard',         label: 'Tổng quan',         group: 'Chung',        adminLevel: 'full', defaultStaffLevel: 'full',   configurable: false },
  { key: 'parking-entry',     label: 'Xe vào',             group: 'Ra / Vào',    adminLevel: 'full', defaultStaffLevel: 'full',   configurable: false },
  { key: 'parking-exit',      label: 'Xe ra',              group: 'Ra / Vào',    adminLevel: 'full', defaultStaffLevel: 'full',   configurable: false },
  { key: 'parking-history',   label: 'Lịch sử đỗ xe',      group: 'Ra / Vào',    adminLevel: 'full', defaultStaffLevel: 'full',   configurable: false },
  { key: 'parking-spots',     label: 'Bãi đỗ xe',          group: 'Hạ tầng',     adminLevel: 'full', defaultStaffLevel: 'view',   configurable: true  },
  { key: 'customers',         label: 'Khách hàng',          group: 'Nghiệp vụ',   adminLevel: 'full', defaultStaffLevel: 'full',   configurable: true  },
  { key: 'vehicles',          label: 'Phương tiện',         group: 'Nghiệp vụ',   adminLevel: 'full', defaultStaffLevel: 'full',   configurable: true  },
  { key: 'vehicle-types',     label: 'Loại xe',             group: 'Danh mục',    adminLevel: 'full', defaultStaffLevel: 'view',   configurable: true  },
  { key: 'packages',          label: 'Gói dịch vụ',         group: 'Danh mục',    adminLevel: 'full', defaultStaffLevel: 'view',   configurable: true  },
  { key: 'customer-packages', label: 'Đăng ký gói',         group: 'Nghiệp vụ',   adminLevel: 'full', defaultStaffLevel: 'full',   configurable: true  },
  { key: 'payments',          label: 'Thanh toán',          group: 'Quản trị',    adminLevel: 'full', defaultStaffLevel: 'hidden', configurable: true  },
  { key: 'alerts',            label: 'Cảnh báo',            group: 'Quản trị',    adminLevel: 'full', defaultStaffLevel: 'hidden', configurable: true  },
  { key: 'reports',           label: 'Báo cáo thống kê',   group: 'Quản trị',    adminLevel: 'full', defaultStaffLevel: 'hidden', configurable: true  },
  { key: 'analytics',         label: 'Phân tích & Gợi ý',  group: 'Quản trị',    adminLevel: 'full', defaultStaffLevel: 'hidden', configurable: false },
  { key: 'users',             label: 'Người dùng',          group: 'Hệ thống',    adminLevel: 'full', defaultStaffLevel: 'hidden', configurable: false },
  { key: 'activity-logs',     label: 'Nhật ký hoạt động',  group: 'Hệ thống',    adminLevel: 'full', defaultStaffLevel: 'hidden', configurable: false },
];

const STORAGE_KEY = 'qlbdx_staff_perms_v1';

export type StaffPermMap = Record<string, AccessLevel>;

/** Load staff permissions từ localStorage, fallback về default. */
export function loadStaffPerms(): StaffPermMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StaffPermMap;
  } catch {}
  return buildDefaultPerms();
}

/** Lưu staff permissions vào localStorage. */
export function saveStaffPerms(perms: StaffPermMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
}

/** Reset về default. */
export function resetStaffPerms(): StaffPermMap {
  const defaults = buildDefaultPerms();
  saveStaffPerms(defaults);
  return defaults;
}

function buildDefaultPerms(): StaffPermMap {
  const map: StaffPermMap = {};
  SCREENS.forEach((s) => { map[s.key] = s.defaultStaffLevel; });
  return map;
}

/** Trả về danh sách keys mà staff có thể thấy (not 'hidden'). */
export function getStaffVisibleKeys(perms: StaffPermMap): Set<string> {
  return new Set(
    SCREENS.filter((s) => (perms[s.key] ?? s.defaultStaffLevel) !== 'hidden').map((s) => s.key)
  );
}

/** Map từ screen key → route path. */
export const SCREEN_ROUTE_MAP: Record<string, string | string[]> = {
  'dashboard':         '/',
  'parking-entry':     '/parking/entry',
  'parking-exit':      '/parking/exit',
  'parking-history':   '/parking/history',
  'parking-spots':     '/parking-spots',
  'customers':         '/customers',
  'vehicles':          '/vehicles',
  'vehicle-types':     '/vehicle-types',
  'packages':          '/packages',
  'customer-packages': '/customer-packages',
  'payments':          '/payments',
  'alerts':            '/alerts',
  'reports':           '/reports',
  'analytics':         '/analytics',
  'users':             '/users',
  'activity-logs':     '/activity-logs',
};
