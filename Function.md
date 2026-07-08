# FUNCTIONAL SPECIFICATION

## AUTH

### FUNC-AUTH-001 – Đăng nhập người dùng

Mô tả:
Đăng nhập hệ thống bằng tài khoản người dùng hợp lệ và trả về JWT cùng thông tin cơ bản người dùng.

Cảnh báo / Validation:
- username không được bỏ trống
- password không được bỏ trống
- tài khoản phải tồn tại và đang hoạt động
- mật khẩu phải đúng

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| username | string | Có | Tên đăng nhập hoặc email |
| password | string | Có | Mật khẩu đăng nhập |

---

### FUNC-AUTH-002 – Đăng ký người dùng

Mô tả:
Tạo tài khoản người dùng mới với vai trò mặc định là admin và lưu mật khẩu dưới dạng hash.

Cảnh báo / Validation:
- username không được bỏ trống
- password tối thiểu 6 ký tự
- fullName không được bỏ trống
- username phải là duy nhất

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| username | string | Có | Tên đăng nhập mới |
| password | string | Có | Mật khẩu mới |
| fullName | string | Có | Họ tên người dùng |
| email | string | Không | Email người dùng |
| phone | string | Không | Số điện thoại |

---

### FUNC-AUTH-003 – Xem thông tin hồ sơ

Mô tả:
Lấy thông tin cá nhân của người dùng đang đăng nhập.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-AUTH-004 – Cập nhật hồ sơ

Mô tả:
Cập nhật thông tin cá nhân của người dùng hiện tại, bao gồm đổi mật khẩu.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT
- fullName nếu có phải không rỗng
- password nếu có phải tối thiểu 6 ký tự

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fullName | string | Có | Họ tên người dùng |
| email | string | Không | Email mới hoặc null |
| phone | string | Không | Số điện thoại mới hoặc null |
| password | string | Không | Mật khẩu mới |

---

## USER

### FUNC-USER-001 – Danh sách người dùng

Mô tả:
Lấy danh sách tất cả người dùng trong hệ thống.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-USER-002 – Thông tin chi tiết người dùng

Mô tả:
Lấy thông tin chi tiết của một người dùng theo ID.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID người dùng |
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-USER-003 – Tạo người dùng

Mô tả:
Tạo một người dùng mới với vai trò admin hoặc staff.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- username không được bỏ trống
- password tối thiểu 6 ký tự
- fullName không được bỏ trống
- role chỉ nhận giá trị admin hoặc staff
- username phải là duy nhất

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| username | string | Có | Tên đăng nhập |
| password | string | Có | Mật khẩu |
| fullName | string | Có | Họ tên |
| email | string | Không | Email |
| phone | string | Không | Số điện thoại |
| role | enum | Không | admin hoặc staff |

---

### FUNC-USER-004 – Cập nhật người dùng

Mô tả:
Cập nhật thông tin người dùng hiện có.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- fullName không được bỏ trống
- password nếu có phải tối thiểu 6 ký tự
- role chỉ nhận admin hoặc staff

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fullName | string | Có | Họ tên |
| email | string | Không | Email |
| phone | string | Không | Số điện thoại |
| role | enum | Không | admin hoặc staff |
| isActive | boolean | Không | Trạng thái hoạt động |
| password | string | Không | Mật khẩu mới |

---

### FUNC-USER-005 – Xóa người dùng

Mô tả:
Xóa một người dùng khỏi hệ thống.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID người dùng |
| Authorization | string | Có | Bearer token JWT |

---

## CUSTOMER

### FUNC-CUST-001 – Danh sách khách hàng

Mô tả:
Lấy danh sách khách hàng đang hoạt động, có thể tìm kiếm theo tên, số điện thoại hoặc CMND.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| search | string | Không | Tìm kiếm theo tên, phone, identityCard |

---

### FUNC-CUST-002 – Chi tiết khách hàng

Mô tả:
Lấy thông tin khách hàng theo ID.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID khách hàng |

---

### FUNC-CUST-003 – Tạo khách hàng

Mô tả:
Thêm khách hàng mới vào hệ thống.

Cảnh báo / Validation:
- fullName không được bỏ trống
- phone không được bỏ trống
- email nếu có phải đúng định dạng

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fullName | string | Có | Tên khách hàng |
| phone | string | Có | Số điện thoại |
| email | string | Không | Email |
| address | string | Không | Địa chỉ |
| identityCard | string | Không | CMND/CCCD |

---

### FUNC-CUST-004 – Cập nhật khách hàng

Mô tả:
Cập nhật thông tin khách hàng hiện tại.

Cảnh báo / Validation:
- fullName không được bỏ trống
- phone không được bỏ trống
- email nếu có phải đúng định dạng

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fullName | string | Có | Tên khách hàng |
| phone | string | Có | Số điện thoại |
| email | string | Không | Email |
| address | string | Không | Địa chỉ |
| identityCard | string | Không | CMND/CCCD |

---

### FUNC-CUST-005 – Vô hiệu hóa khách hàng

Mô tả:
Đánh dấu khách hàng là không hoạt động (soft delete).

Cảnh báo / Validation:
- Chỉ admin mới có quyền xóa khách hàng
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID khách hàng |

---

## VEHICLE

### FUNC-VEH-001 – Danh sách xe

Mô tả:
Lấy danh sách xe, có thể lọc theo biển số hoặc tên chủ.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| search | string | Không | Tìm kiếm theo biển số hoặc tên khách hàng |
| customerId | number | Không | Lọc theo ID khách hàng |

---

### FUNC-VEH-002 – Tìm xe theo biển số

Mô tả:
Lấy thông tin xe theo biển số.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| plate | string | Có | Biển số xe |

---

### FUNC-VEH-003 – Chi tiết xe

Mô tả:
Lấy thông tin xe theo ID.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID xe |

---

### FUNC-VEH-004 – Tạo xe

Mô tả:
Đăng ký xe mới cho khách hàng.

Cảnh báo / Validation:
- customerId phải là số nguyên dương
- vehicleTypeId phải là số nguyên dương
- licensePlate không được bỏ trống và phải đúng định dạng
- licensePlate phải là duy nhất

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| customerId | number | Có | ID khách hàng |
| vehicleTypeId | number | Có | ID loại xe |
| licensePlate | string | Có | Biển số xe |
| brand | string | Không | Hãng xe |
| model | string | Không | Dòng xe |
| color | string | Không | Màu xe |

---

### FUNC-VEH-005 – Cập nhật xe

Mô tả:
Cập nhật thông tin xe hiện có.

Cảnh báo / Validation:
- customerId phải là số nguyên dương
- vehicleTypeId phải là số nguyên dương
- licensePlate không được bỏ trống và phải đúng định dạng

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| customerId | number | Có | ID khách hàng |
| vehicleTypeId | number | Có | ID loại xe |
| licensePlate | string | Có | Biển số xe |
| brand | string | Không | Hãng xe |
| model | string | Không | Dòng xe |
| color | string | Không | Màu xe |

---

### FUNC-VEH-006 – Xóa xe

Mô tả:
Xóa xe theo ID.

Cảnh báo / Validation:
- Chỉ admin mới có quyền xóa xe
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID xe |

---

## VEHICLETYPE

### FUNC-VT-001 – Danh sách loại xe

Mô tả:
Lấy danh sách các loại xe.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-VT-002 – Tạo loại xe

Mô tả:
Thêm loại xe mới với giá giờ, giá ngày, giá tháng.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- name không được bỏ trống
- hourlyRate, dailyRate, monthlyRate phải lớn hơn 0

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| name | string | Có | Tên loại xe |
| description | string | Không | Mô tả |
| hourlyRate | number | Có | Giá theo giờ |
| dailyRate | number | Có | Giá theo ngày |
| monthlyRate | number | Có | Giá theo tháng |

---

### FUNC-VT-003 – Cập nhật loại xe

Mô tả:
Cập nhật thông tin loại xe.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- name không được bỏ trống
- hourlyRate, dailyRate, monthlyRate phải lớn hơn 0

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| name | string | Có | Tên loại xe |
| description | string | Không | Mô tả |
| hourlyRate | number | Có | Giá theo giờ |
| dailyRate | number | Có | Giá theo ngày |
| monthlyRate | number | Có | Giá theo tháng |

---

### FUNC-VT-004 – Xóa loại xe

Mô tả:
Xóa loại xe nếu không có xe hoặc gói dịch vụ liên kết.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- Không xóa được nếu còn xe hoặc gói đỗ xe liên quan

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID loại xe |

---

## PACKAGE

### FUNC-PKG-001 – Danh sách gói đỗ xe

Mô tả:
Lấy danh sách các gói đỗ xe đang hoạt động.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-PKG-002 – Tạo gói đỗ xe

Mô tả:
Tạo gói đỗ xe mới dành cho loại xe cụ thể.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- name không được bỏ trống
- vehicleTypeId phải là số nguyên dương
- durationDays phải lớn hơn 0
- price phải lớn hơn 0

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| name | string | Có | Tên gói |
| vehicleTypeId | number | Có | ID loại xe |
| durationDays | number | Có | Số ngày |
| price | number | Có | Giá |
| description | string | Không | Mô tả |

---

### FUNC-PKG-003 – Cập nhật gói đỗ xe

Mô tả:
Cập nhật thông tin gói đỗ xe.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- name không được bỏ trống
- vehicleTypeId phải là số nguyên dương
- durationDays phải lớn hơn 0
- price phải lớn hơn 0

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| name | string | Có | Tên gói |
| vehicleTypeId | number | Có | ID loại xe |
| durationDays | number | Có | Số ngày |
| price | number | Có | Giá |
| description | string | Không | Mô tả |
| isActive | boolean | Không | Trạng thái hoạt động |

---

### FUNC-PKG-004 – Xóa gói đỗ xe

Mô tả:
Xóa gói đỗ xe và xóa liên quan đến customer packages và payments.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID gói đỗ xe |

---

## CUSTOMER_PACKAGE

### FUNC-CPKG-001 – Danh sách gói dịch vụ của khách hàng

Mô tả:
Lấy danh sách gói dịch vụ đã đăng ký, có thể lọc theo khách hàng và trạng thái.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| customerId | number | Không | Lọc theo khách hàng |
| status | string | Không | active/expired/cancelled |

---

### FUNC-CPKG-002 – Đăng ký gói dịch vụ

Mô tả:
Tạo bản ghi gói dịch vụ cho khách hàng, tính thời hạn kết thúc và tạo bản ghi thanh toán.

Cảnh báo / Validation:
- customerId phải là số nguyên dương
- packageId phải là số nguyên dương
- vehicleId phải là số nguyên dương
- startDate không được bỏ trống
- package phải tồn tại

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| customerId | number | Có | ID khách hàng |
| packageId | number | Có | ID gói đỗ xe |
| vehicleId | number | Có | ID xe |
| startDate | string | Có | Ngày bắt đầu |

---

### FUNC-CPKG-003 – Cập nhật gói dịch vụ

Mô tả:
Cập nhật thông tin gói dịch vụ hiện có.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- customerId nếu có phải là số nguyên dương
- vehicleId nếu có phải là số nguyên dương
- status chỉ nhận active/expired/cancelled

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| customerId | number | Không | ID khách hàng |
| vehicleId | number | Không | ID xe |
| status | enum | Không | active/expired/cancelled |

---

### FUNC-CPKG-004 – Xóa gói dịch vụ

Mô tả:
Xóa một đăng ký gói dịch vụ và các thanh toán liên quan.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID đăng ký gói dịch vụ |

---

### FUNC-CPKG-005 – Kiểm tra gói dịch vụ đang hoạt động

Mô tả:
Kiểm tra xem xe có gói dịch vụ active và còn hạn hay không.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT
- ID xe phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| vehicleId | number | Có | ID xe |

---

## PARKING

### FUNC-PARK-001 – Danh sách trạng thái đỗ xe

Mô tả:
Lấy danh sách bản ghi đỗ xe theo trạng thái hiện tại, mặc định trả về trạng thái parked.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| status | string | Không | Trạng thái parking record |

---

### FUNC-PARK-002 – Ghi nhận vào bãi

Mô tả:
Tạo bản ghi vào bãi, kiểm tra trùng biển số, kiểm tra chỗ đỗ và kiểm tra dung lượng bãi.

Cảnh báo / Validation:
- licensePlate không được bỏ trống và phải đúng định dạng
- vehicleTypeId phải là số nguyên dương
- parkingSpotId nếu có phải là số nguyên dương
- chỗ đỗ phải tồn tại và đang available
- không cho phép xe đã đang parked vào thêm
- nếu đã có chỗ nhưng không có chỗ available thì từ chối

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| licensePlate | string | Có | Biển số xe |
| vehicleTypeId | number | Có | ID loại xe |
| parkingSpotId | number | Không | ID chỗ đỗ |
| notes | string | Không | Ghi chú |

---

### FUNC-PARK-003 – Ghi nhận ra bãi

Mô tả:
Cập nhật bản ghi ra bãi, tính phí theo giờ/ngày hoặc miễn phí nếu có gói active, tạo bản ghi thanh toán nếu có phí.

Cảnh báo / Validation:
- parkingRecordId phải là số nguyên dương
- bản ghi phải tồn tại và đang có status parked
- tính toán thời gian và phí chính xác
- nếu có gói active thì không tính phí

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| parkingRecordId | number | Có | ID bản ghi đỗ xe |
| paymentMethod | enum | Không | cash/card/transfer |

---

### FUNC-PARK-004 – Xem ước tính phí hiện thời

Mô tả:
Ước tính phí hiện tại của xe đang đỗ, bao gồm kiểm tra gói active và thời hạn còn lại.

Cảnh báo / Validation:
- ID phải là số nguyên hợp lệ
- bản ghi phải tồn tại và đang có status parked

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID bản ghi đỗ xe |

---

### FUNC-PARK-005 – Lịch sử xe đã ra bãi

Mô tả:
Lấy danh sách các bản ghi đỗ xe đã hoàn thành, có thể lọc theo khoảng thời gian và biển số.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| from | string | Không | Ngày bắt đầu lọc |
| to | string | Không | Ngày kết thúc lọc |
| licensePlate | string | Không | Lọc theo biển số |

---

## PARKING_ZONE

### FUNC-PZ-001 – Danh sách khu vực đỗ xe

Mô tả:
Lấy danh sách khu vực đỗ xe cùng số liệu chỗ trống và chỗ đã sử dụng.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-PZ-002 – Tạo khu vực đỗ xe

Mô tả:
Tạo khu vực đỗ xe mới.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- name không được bỏ trống

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| name | string | Có | Tên khu vực |
| description | string | Không | Mô tả |

---

### FUNC-PZ-003 – Cập nhật khu vực đỗ xe

Mô tả:
Cập nhật tên và mô tả khu vực đỗ xe.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- name không được bỏ trống

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| name | string | Có | Tên khu vực |
| description | string | Không | Mô tả |

---

### FUNC-PZ-004 – Xóa khu vực đỗ xe

Mô tả:
Xóa khu vực đỗ xe, xóa các chỗ đỗ thuộc khu vực và gỡ liên kết các bản ghi đỗ xe.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID khu vực |

---

## PARKING_SPOT

### FUNC-PS-001 – Danh sách chỗ đỗ

Mô tả:
Lấy danh sách chỗ đỗ, có thể lọc theo khu vực và trạng thái.

Cảnh báo / Validation:
- Yêu cầu xác thực bằng JWT

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| zoneId | number | Không | Lọc theo khu vực |
| status | string | Không | Trạng thái chỗ đỗ |

---

### FUNC-PS-002 – Tạo chỗ đỗ

Mô tả:
Thêm chỗ đỗ mới vào khu vực cụ thể.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- zoneId phải là số nguyên dương
- spotNumber không được bỏ trống
- spotType nếu có chỉ nhận standard/vip/disabled

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| zoneId | number | Có | ID khu vực |
| spotNumber | string | Có | Mã số chỗ |
| spotType | enum | Không | standard/vip/disabled |

---

### FUNC-PS-003 – Cập nhật chỗ đỗ

Mô tả:
Cập nhật loại và trạng thái chỗ đỗ.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- spotType nếu có chỉ nhận standard/vip/disabled
- status nếu có chỉ nhận available/occupied/reserved/maintenance

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| spotType | enum | Không | standard/vip/disabled |
| status | enum | Không | available/occupied/reserved/maintenance |

---

### FUNC-PS-004 – Xóa chỗ đỗ

Mô tả:
Xóa một chỗ đỗ và gỡ liên kết với các bản ghi đỗ xe.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- ID phải là số nguyên hợp lệ

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| id | number | Có | ID chỗ đỗ |

---

## PAYMENT

### FUNC-PAY-001 – Xem danh sách thanh toán

Mô tả:
Lấy danh sách thanh toán đã hoàn thành, có thể lọc theo ngày và phương thức.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fromDate | string | Không | Ngày bắt đầu lọc |
| toDate | string | Không | Ngày kết thúc lọc |
| paymentMethod | string | Không | Phương thức thanh toán |

---

## REPORT

### FUNC-REP-001 – Báo cáo dashboard

Mô tả:
Trả về các chỉ số tổng quan như số xe đang đỗ, số chỗ trống, lượt vào hôm nay và doanh thu hôm nay/tháng.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

### FUNC-REP-002 – Báo cáo doanh thu

Mô tả:
Lấy doanh thu theo khoảng thời gian và nhóm theo ngày/tháng/năm.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fromDate | string | Không | Ngày bắt đầu lọc |
| toDate | string | Không | Ngày kết thúc lọc |
| groupBy | string | Không | day/month/year |

---

### FUNC-REP-003 – Báo cáo thống kê theo loại xe

Mô tả:
Trả về số lượt và tổng phí theo loại xe trong khoảng thời gian.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- Nếu không truyền from/to thì mặc định là tháng hiện tại

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| fromDate | string | Không | Ngày bắt đầu lọc |
| toDate | string | Không | Ngày kết thúc lọc |

---

### FUNC-REP-004 – Báo cáo thống kê theo giờ

Mô tả:
Đếm số lượt vào theo từng giờ trong ngày hiện tại.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| Authorization | string | Có | Bearer token JWT |

---

## ACTIVITY_LOG

### FUNC-ACT-001 – Xem nhật ký hoạt động

Mô tả:
Lấy danh sách nhật ký hành động người dùng, hỗ trợ phân trang và lọc theo người dùng, hành động, thực thể và khoảng thời gian.

Cảnh báo / Validation:
- Chỉ admin được phép truy cập
- page và limit phải là số nguyên nếu có

| Thành phần | Kiểu dữ liệu | Bắt buộc | Mô tả |
|------------|------------|----------|------|
| page | number | Không | Trang kết quả |
| limit | number | Không | Số bản ghi mỗi trang |
| userId | number | Không | Lọc theo ID người dùng |
| action | string | Không | Lọc theo hành động |
| entity | string | Không | Lọc theo thực thể |
| from | string | Không | Ngày bắt đầu lọc |
| to | string | Không | Ngày kết thúc lọc |
