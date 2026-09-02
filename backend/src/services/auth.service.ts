/**
 * Nghiệp vụ tài khoản: đăng nhập, tạo tài khoản nhân viên, xem và sửa hồ sơ cá nhân.
 *
 * Vị trí trong luồng đăng nhập:
 *   pages/Login.tsx -> POST /api/auth/login -> auth.controller -> auth.service (file này)
 *     -> so khớp mật khẩu bcrypt -> ký JWT -> frontend lưu token
 *     -> mọi request sau đó gắn token -> middlewares/auth.ts kiểm tra lại
 *
 * Hai thư viện bảo mật dùng ở đây:
 *   - bcryptjs: băm mật khẩu một chiều, để DB không bao giờ lưu mật khẩu gốc.
 *   - jsonwebtoken: cấp "vé" có chữ ký và có hạn, thay cho việc lưu phiên đăng nhập trên server.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { config } from '../config';
import { LoginInput, RegisterInput } from '../validators/auth.validator';

export class AuthService {
  /**
   * Đăng nhập: đối chiếu tài khoản/mật khẩu rồi cấp JWT.
   *
   * @param data username (cho phép nhập tên đăng nhập HOẶC email) và password dạng thô.
   * @returns token JWT + thông tin cơ bản của người dùng để frontend hiển thị.
   */
  async login(data: LoginInput) {
    const loginValue = data.username.trim();

    // Cho đăng nhập bằng username hoặc email để người dùng khỏi phải nhớ chính xác một loại.
    // Lọc luôn isActive ngay trong truy vấn: tài khoản bị khoá coi như không tồn tại.
    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { username: loginValue },
          { email: loginValue },
        ],
      },
    });

    // Hai trường hợp "không có tài khoản" và "sai mật khẩu" cố tình trả về CÙNG một thông báo.
    // Nếu tách riêng thì người dò tài khoản sẽ biết username nào có thật để tập trung dò mật khẩu.
    if (!user) {
      throw { status: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    }

    // Mật khẩu trong DB lưu dạng băm bcrypt, không lưu bản rõ. bcrypt.compare băm lại mật khẩu
    // vừa nhập với đúng "muối" đã lưu rồi so sánh — không thể giải ngược chuỗi băm về mật khẩu.
    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    }

    // Token chỉ chứa thông tin định danh, TUYỆT ĐỐI không chứa mật khẩu: phần payload của JWT
    // chỉ được mã hoá base64 (ai cũng đọc được), chữ ký chỉ đảm bảo nội dung không bị sửa.
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Tạo tài khoản nhân viên mới. Chỉ admin gọi được (route đã chặn bằng `adminOnly`),
   * nên vai trò được gán cứng là 'staff' — không cho client tự chọn role, tránh việc gửi
   * kèm role: 'admin' để tự nâng quyền.
   */
  async register(data: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      throw { status: 400, message: 'Tên đăng nhập đã tồn tại' };
    }

    if (data.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: data.email },
        select: { id: true },
      });

      if (existingEmail) {
        throw { status: 400, message: 'Email đã được sử dụng' };
      }
    }

    // Băm mật khẩu trước khi lưu. Mỗi tài khoản có "muối" (salt) riêng nên hai người đặt
    // trùng mật khẩu vẫn cho ra hai chuỗi băm khác nhau, không tra ngược được bằng bảng dựng sẵn.
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        role: 'staff',
      },
    });

    return { message: 'Tạo tài khoản nhân viên thành công' };
  }

  /**
   * Lấy hồ sơ người dùng đang đăng nhập, kèm ma trận quyền để frontend ẩn/hiện nút.
   * Frontend gọi API này ngay sau khi đăng nhập (xem frontend/src/context/AuthContext.tsx).
   */
  async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        permissionGroupId: true,
        permissionGroup: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    // Admin không qua nhóm quyền (luôn toàn quyền — enforce ở requirePermission middleware).
    // Staff: trả về ma trận quyền thật của nhóm để frontend ẩn/hiện nút Thêm/Sửa/Xóa đúng, không
    // phải đoán qua "configurable" tĩnh như permConfig.ts cũ.
    const permissions = user.role !== 'admin' && user.permissionGroupId
      ? await prisma.groupPermission.findMany({ where: { groupId: user.permissionGroupId } })
      : [];

    return { ...user, permissions };
  }

  /**
   * Người dùng tự sửa hồ sơ của mình (màn hình Thông tin cá nhân).
   *
   * Chỉ ghi những field thực sự được gửi lên: nếu gán giá trị mặc định cho field vắng mặt thì
   * sửa mỗi họ tên cũng vô tình xoá email/điện thoại. `password` chỉ được băm và ghi đè khi
   * người dùng chủ động nhập mật khẩu mới.
   */
  async updateProfile(userId: number, data: { fullName?: string; email?: string; phone?: string; password?: string }) {
    const updateData: any = {};
    if (data.fullName) updateData.fullName = data.fullName;
    // Gửi chuỗi rỗng nghĩa là người dùng đã xoá trắng ô nhập -> lưu null thay vì lưu ''.
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    await prisma.user.update({ where: { id: userId }, data: updateData });
    return { message: 'Cập nhật thông tin thành công' };
  }
}

export const authService = new AuthService();
