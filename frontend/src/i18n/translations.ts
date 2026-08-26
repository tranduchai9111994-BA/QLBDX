/**
 * translations.ts — bộ từ điển VI/EN cho toàn hệ thống PSM.
 * Thêm key mới vào đây; component dùng hook useT() để lấy bản dịch.
 */

export type Lang = 'vi' | 'en';

export type TranslationKey = keyof typeof vi;

/* ─── Vietnamese (mặc định) ─────────────────────────────────────── */
export const vi = {
  /* App */
  appName: 'Quản lý bãi đỗ xe',
  appShort: 'PSM',

  /* Menu */
  menuDashboard: 'Tổng quan',
  menuParkingManage: 'Quản lý ra vào',
  menuParkingEntry: 'Xe vào',
  menuParkingExit: 'Xe ra',
  menuParkingHistory: 'Lịch sử',
  menuParkingSpots: 'Bãi đỗ xe',
  menuCustomers: 'Khách hàng',
  menuVehicles: 'Phương tiện',
  menuVehicleTypes: 'Loại xe',
  menuPackages: 'Gói dịch vụ',
  menuPackageList: 'Danh sách gói',
  menuCustomerPackages: 'Đăng ký gói',
  menuPayments: 'Thanh toán',
  menuAlerts: 'Cảnh báo',
  menuReports: 'Báo cáo',
  menuAnalytics: 'Phân tích & Gợi ý',
  menuUsers: 'Người dùng',
  menuActivityLogs: 'Nhật ký hoạt động',

  /* User menu */
  userRole: 'Vai trò',
  userRoleAdmin: 'Quản trị',
  userRoleStaff: 'Nhân viên',
  myProfile: 'Thông tin cá nhân',
  logout: 'Đăng xuất',

  /* Common buttons */
  btnAdd: 'Thêm',
  btnEdit: 'Sửa',
  btnDelete: 'Xóa',
  btnSave: 'Lưu',
  btnCancel: 'Hủy',
  btnClose: 'Đóng',
  btnConfirm: 'Xác nhận',
  btnSearch: 'Tìm kiếm',
  btnReset: 'Xóa bộ lọc',
  btnRefresh: 'Làm mới',
  btnExport: 'Xuất',
  btnImport: 'Nhập Excel',
  btnDownloadTemplate: 'Tải template',
  btnUpdate: 'Cập nhật',
  btnRegister: 'Đăng ký',
  btnPrint: 'In biên nhận',

  /* Common fields */
  fieldSearch: 'Tìm kiếm...',
  fieldStatus: 'Trạng thái',
  fieldRole: 'Vai trò',
  fieldAction: 'Thao tác',
  fieldName: 'Họ tên',
  fieldPhone: 'Số điện thoại',
  fieldEmail: 'Email',
  fieldAddress: 'Địa chỉ',
  fieldNote: 'Ghi chú',
  fieldDate: 'Ngày',
  fieldStartDate: 'Ngày bắt đầu',
  fieldEndDate: 'Ngày kết thúc',
  fieldPrice: 'Giá',
  fieldFee: 'Phí',
  fieldCreatedAt: 'Ngày tạo',

  /* Status labels */
  statusActive: 'Hoạt động',
  statusInactive: 'Ngừng hoạt động',
  statusExpired: 'Hết hạn',
  statusCancelled: 'Đã hủy',
  statusPending: 'Chưa hiệu lực',
  statusParked: 'Đang trong bãi',
  statusOutside: 'Đang ở ngoài',

  /* Dashboard */
  pageDashboard: 'Tổng quan',
  dashOccupancy: 'Lấp đầy',
  dashCurrentParked: 'Xe đang trong bãi',
  dashTodayRevenue: 'Doanh thu hôm nay',
  dashTotalSlots: 'Tổng chỗ',
  dashAvailableSlots: 'Chỗ trống',
  dashAlerts: 'Cảnh báo ưu tiên',

  /* Parking Entry */
  pageParkingEntry: 'Ghi nhận xe vào',
  colLicensePlate: 'Biển số xe',
  colVehicleType: 'Loại xe',
  colParkingSpot: 'Vị trí đỗ',
  colEntryTime: 'Giờ vào',
  colExitTime: 'Giờ ra',
  colDuration: 'Thời gian',
  colFee: 'Phí gửi xe',
  colPaymentMethod: 'PTTT',
  colCategory: 'Phân loại',
  categoryMonthly: 'Xe tháng',
  categoryDaily: 'Vãng lai',

  /* Parking Exit */
  pageParkingExit: 'Ghi nhận xe ra',
  btnCheckout: 'Cho xe ra',
  btnPreviewFee: 'Xem trước phí',

  /* Parking History */
  pageParkingHistory: 'Lịch sử đỗ xe',

  /* Parking Spots */
  pageParkingSpots: 'Quản lý bãi đỗ xe',
  colZone: 'Khu vực',
  colCapacity: 'Sức chứa',
  colOccupied: 'Đã dùng',

  /* Customers */
  pageCustomers: 'Quản lý khách hàng',
  colIdentityCard: 'CMND/CCCD',
  btnAddCustomer: 'Thêm khách hàng',

  /* Vehicles */
  pageVehicles: 'Quản lý phương tiện',
  colBrand: 'Hãng',
  colModel: 'Model',
  colColor: 'Màu sắc',
  colOwner: 'Chủ xe',
  btnAddVehicle: 'Thêm phương tiện',

  /* Vehicle Types */
  pageVehicleTypes: 'Loại xe',
  colHourlyRate: 'Phí/giờ',
  colDailyRate: 'Phí/ngày',

  /* Packages */
  pagePackages: 'Danh sách gói dịch vụ',
  colPackageDuration: 'Thời hạn (ngày)',
  btnAddPackage: 'Thêm gói',

  /* Customer Packages */
  pageCustomerPackages: 'Gói dịch vụ của khách hàng',
  colCustomer: 'Khách hàng',
  colPackage: 'Gói',
  colVehicle: 'Phương tiện',
  btnRegisterPackage: 'Đăng ký gói dịch vụ',
  btnRenew: 'Gia hạn',
  btnCancelPackage: 'Hủy gói',

  /* Payments */
  pagePayments: 'Lịch sử thanh toán',
  colAmount: 'Số tiền',
  colPaymentType: 'Loại GD',

  /* Alerts */
  pageAlerts: 'Cảnh báo hệ thống',

  /* Reports */
  pageReports: 'Báo cáo thống kê',

  /* Users */
  pageUsers: 'Quản lý người dùng',
  colUsername: 'Tên đăng nhập',
  colFullName: 'Họ tên',
  btnAddUser: 'Thêm người dùng',
  tabUserList: 'Danh sách người dùng',
  tabPermissions: 'Phân quyền chức năng',

  /* Activity Logs */
  pageActivityLogs: 'Nhật ký hoạt động',

  /* Auth */
  loginTitle: 'Đăng nhập hệ thống',
  loginUsername: 'Tên đăng nhập',
  loginPassword: 'Mật khẩu',
  loginBtn: 'Đăng nhập',

  /* Import */
  importTitle: 'Nhập dữ liệu',
  importStep1: 'Bước 1: Tải file mẫu (template)',
  importStep2: 'Bước 2: Tải file đã điền lên',
  importDragHint: 'Kéo file vào đây hoặc click để chọn',
  importPreview: 'Kiểm tra dữ liệu trước khi nhập',
  importSuccess: 'Nhập thành công',
  importError: 'dòng có lỗi',

  /* Extra column aliases */
  colMonthlyRate: 'Giá/tháng (đ)',
  colVehicleCount: 'Số xe',
  colSlotCount: 'Số chỗ',
  colAvailable: 'Trống',
  colUser: 'Nhân viên',
  colAction: 'Thao tác',
  colTime: 'Thời gian',
  colIpAddress: 'IP',

  /* Dashboard extras */
  dashGreeting: 'Xin chào',
  dashTodayTrips: 'Lượt xe hôm nay',
  dashLongParked: 'Xe đỗ lâu',
  dashNearFull: 'Khu gần đầy',

  /* Misc */
  loading: 'Đang tải...',
  noData: 'Không có dữ liệu',
  confirmDelete: 'Xác nhận xóa',
  confirmCancel: 'Xác nhận hủy',
  lastUpdated: 'Cập nhật lúc',
  today: 'Hôm nay',
  allStatus: 'Tất cả trạng thái',
  allRoles: 'Tất cả vai trò',
} as const;

/* ─── English ───────────────────────────────────────────────────── */
export const en: Record<TranslationKey, string> = {
  /* App */
  appName: 'Parking Management System',
  appShort: 'PSM',

  /* Menu */
  menuDashboard: 'Dashboard',
  menuParkingManage: 'Parking Management',
  menuParkingEntry: 'Entry',
  menuParkingExit: 'Exit',
  menuParkingHistory: 'History',
  menuParkingSpots: 'Parking Zones',
  menuCustomers: 'Customers',
  menuVehicles: 'Vehicles',
  menuVehicleTypes: 'Vehicle Types',
  menuPackages: 'Service Packages',
  menuPackageList: 'Package List',
  menuCustomerPackages: 'Package Registration',
  menuPayments: 'Payments',
  menuAlerts: 'Alerts',
  menuReports: 'Reports',
  menuAnalytics: 'Analytics & Suggestions',
  menuUsers: 'Users',
  menuActivityLogs: 'Activity Logs',

  /* User menu */
  userRole: 'Role',
  userRoleAdmin: 'Admin',
  userRoleStaff: 'Staff',
  myProfile: 'My Profile',
  logout: 'Log out',

  /* Common buttons */
  btnAdd: 'Add',
  btnEdit: 'Edit',
  btnDelete: 'Delete',
  btnSave: 'Save',
  btnCancel: 'Cancel',
  btnClose: 'Close',
  btnConfirm: 'Confirm',
  btnSearch: 'Search',
  btnReset: 'Clear filters',
  btnRefresh: 'Refresh',
  btnExport: 'Export',
  btnImport: 'Import Excel',
  btnDownloadTemplate: 'Download template',
  btnUpdate: 'Update',
  btnRegister: 'Register',
  btnPrint: 'Print receipt',

  /* Common fields */
  fieldSearch: 'Search...',
  fieldStatus: 'Status',
  fieldRole: 'Role',
  fieldAction: 'Actions',
  fieldName: 'Full name',
  fieldPhone: 'Phone number',
  fieldEmail: 'Email',
  fieldAddress: 'Address',
  fieldNote: 'Note',
  fieldDate: 'Date',
  fieldStartDate: 'Start date',
  fieldEndDate: 'End date',
  fieldPrice: 'Price',
  fieldFee: 'Fee',
  fieldCreatedAt: 'Created at',

  /* Status labels */
  statusActive: 'Active',
  statusInactive: 'Inactive',
  statusExpired: 'Expired',
  statusCancelled: 'Cancelled',
  statusPending: 'Pending',
  statusParked: 'Parked',
  statusOutside: 'Outside',

  /* Dashboard */
  pageDashboard: 'Dashboard',
  dashOccupancy: 'Occupancy',
  dashCurrentParked: 'Currently parked',
  dashTodayRevenue: "Today's revenue",
  dashTotalSlots: 'Total slots',
  dashAvailableSlots: 'Available',
  dashAlerts: 'Priority alerts',

  /* Parking Entry */
  pageParkingEntry: 'Vehicle Entry',
  colLicensePlate: 'License plate',
  colVehicleType: 'Vehicle type',
  colParkingSpot: 'Parking spot',
  colEntryTime: 'Entry time',
  colExitTime: 'Exit time',
  colDuration: 'Duration',
  colFee: 'Parking fee',
  colPaymentMethod: 'Payment',
  colCategory: 'Category',
  categoryMonthly: 'Monthly',
  categoryDaily: 'Daily',

  /* Parking Exit */
  pageParkingExit: 'Vehicle Exit',
  btnCheckout: 'Check out',
  btnPreviewFee: 'Preview fee',

  /* Parking History */
  pageParkingHistory: 'Parking History',

  /* Parking Spots */
  pageParkingSpots: 'Parking Zone Management',
  colZone: 'Zone',
  colCapacity: 'Capacity',
  colOccupied: 'Occupied',

  /* Customers */
  pageCustomers: 'Customer Management',
  colIdentityCard: 'ID Card',
  btnAddCustomer: 'Add customer',

  /* Vehicles */
  pageVehicles: 'Vehicle Management',
  colBrand: 'Brand',
  colModel: 'Model',
  colColor: 'Color',
  colOwner: 'Owner',
  btnAddVehicle: 'Add vehicle',

  /* Vehicle Types */
  pageVehicleTypes: 'Vehicle Types',
  colHourlyRate: 'Hourly rate',
  colDailyRate: 'Daily rate',

  /* Packages */
  pagePackages: 'Service Package List',
  colPackageDuration: 'Duration (days)',
  btnAddPackage: 'Add package',

  /* Customer Packages */
  pageCustomerPackages: 'Customer Package Registration',
  colCustomer: 'Customer',
  colPackage: 'Package',
  colVehicle: 'Vehicle',
  btnRegisterPackage: 'Register package',
  btnRenew: 'Renew',
  btnCancelPackage: 'Cancel package',

  /* Payments */
  pagePayments: 'Payment History',
  colAmount: 'Amount',
  colPaymentType: 'Type',

  /* Alerts */
  pageAlerts: 'System Alerts',

  /* Reports */
  pageReports: 'Statistics & Reports',

  /* Users */
  pageUsers: 'User Management',
  colUsername: 'Username',
  colFullName: 'Full name',
  btnAddUser: 'Add user',
  tabUserList: 'User list',
  tabPermissions: 'Role permissions',

  /* Activity Logs */
  pageActivityLogs: 'Activity Logs',

  /* Auth */
  loginTitle: 'System Login',
  loginUsername: 'Username',
  loginPassword: 'Password',
  loginBtn: 'Log in',

  /* Import */
  importTitle: 'Import data',
  importStep1: 'Step 1: Download template file',
  importStep2: 'Step 2: Upload completed file',
  importDragHint: 'Drag file here or click to browse',
  importPreview: 'Review data before importing',
  importSuccess: 'Successfully imported',
  importError: 'rows with errors',

  /* Extra column aliases */
  colMonthlyRate: 'Monthly rate',
  colVehicleCount: '# Vehicles',
  colSlotCount: '# Slots',
  colAvailable: 'Available',
  colUser: 'Staff',
  colAction: 'Actions',
  colTime: 'Time',
  colIpAddress: 'IP',

  /* Dashboard extras */
  dashGreeting: 'Hello',
  dashTodayTrips: "Today's trips",
  dashLongParked: 'Long-parked',
  dashNearFull: 'Near-full zones',

  /* Misc */
  loading: 'Loading...',
  noData: 'No data',
  confirmDelete: 'Confirm delete',
  confirmCancel: 'Confirm cancel',
  lastUpdated: 'Last updated',
  today: 'Today',
  allStatus: 'All statuses',
  allRoles: 'All roles',
};

export const translations: Record<Lang, Record<TranslationKey, string>> = { vi, en };
