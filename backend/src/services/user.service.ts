/**
 * Nghiệp vụ quản lý TÀI KHOẢN người dùng hệ thống (admin và nhân viên).
 *
 * Vị trí trong luồng:
 *   pages/Users.tsx -> /api/users -> file này -> bảng Users
 *   Toàn bộ API ở đây chỉ admin gọi được (route chặn bằng middleware `adminOnly`).
 *
 * Phân biệt với auth.service.ts: file đó là người dùng TỰ thao tác với tài khoản của mình
 * (đăng nhập, sửa hồ sơ); file này là admin thao tác với tài khoản NGƯỜI KHÁC.
 *
 * Hai nguyên tắc an toàn xuyên suốt:
 *   1. Không bao giờ trả cột `passwordHash` ra ngoài — mọi truy vấn đều liệt kê cột bằng `select`.
 *   2. Hệ thống phải luôn còn ít nhất một admin đang hoạt động.
 */
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { CreateUserInput, UpdateUserInput } from '../validators/user.validator';

export class UserService {
  /**
   * Danh sách tài khoản.
   *
   * Dùng `select` liệt kê rõ từng cột thay vì lấy hết bản ghi — quan trọng vì bảng Users có cột
   * `passwordHash`. Nếu trả cả object thì chuỗi băm mật khẩu sẽ lọt ra ngoài qua API.
   */
  async findAll() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        permissionGroupId: true,
        permissionGroup: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Chi tiết một tài khoản. Cũng chỉ chọn các cột an toàn, không trả `passwordHash`. */
  async findById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        permissionGroupId: true,
        permissionGroup: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    return user;
  }

  /** Admin tạo tài khoản mới. Tên đăng nhập và email không được trùng với tài khoản đã có. */
  async create(data: CreateUserInput) {
    const [existing, existingEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { username: data.username },
      }),
      data.email
        ? prisma.user.findFirst({
            where: { email: data.email },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (existing) {
      throw { status: 400, message: 'Tên đăng nhập đã tồn tại' };
    }

    if (existingEmail) {
      throw { status: 400, message: 'Email đã được sử dụng' };
    }

    if (data.permissionGroupId) {
      const group = await prisma.permissionGroup.findUnique({ where: { id: data.permissionGroupId } });
      if (!group) throw { status: 400, message: 'Nhóm quyền không tồn tại' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        role: data.role ?? 'staff',
        // Admin luôn toàn quyền, không gắn nhóm quyền.
        permissionGroupId: data.role === 'admin' ? null : (data.permissionGroupId ?? null),
      },
    });

    return { message: 'Tạo người dùng thành công', id: user.id };
  }

  /**
   * Admin sửa tài khoản người khác.
   *
   * Hai LỚP BẢO VỆ chống việc tự khoá hệ thống — nếu admin cuối cùng bị vô hiệu hoá hoặc bị hạ
   * xuống nhân viên thì sẽ không còn ai vào được các chức năng quản trị:
   *   - Không cho tắt hoạt động admin cuối cùng.
   *   - Không cho hạ quyền admin cuối cùng xuống 'staff'.
   *
   * Ngoài ra: tài khoản admin luôn được đặt `permissionGroupId = null`, vì admin toàn quyền,
   * không đi qua ma trận phân quyền theo màn hình (xem middlewares/requirePermission.ts).
   */
  async update(id: number, data: UpdateUserInput) {
    const [user, duplicateEmail, adminCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true },
      }),
      data.email
        ? prisma.user.findFirst({
            where: { email: data.email, NOT: { id } },
            select: { id: true },
          })
        : Promise.resolve(null),
      prisma.user.count({
        where: { role: 'admin', isActive: true },
      }),
    ]);

    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    if (duplicateEmail) {
      throw { status: 400, message: 'Email đã được sử dụng' };
    }

    if (user.role === 'admin' && user.isActive && data.isActive === false && adminCount <= 1) {
      throw { status: 400, message: 'Hệ thống phải còn ít nhất một admin đang hoạt động' };
    }

    if (user.role === 'admin' && user.isActive && data.role === 'staff' && adminCount <= 1) {
      throw { status: 400, message: 'Không thể hạ quyền admin cuối cùng trong hệ thống' };
    }

    if (data.permissionGroupId) {
      const group = await prisma.permissionGroup.findUnique({ where: { id: data.permissionGroupId } });
      if (!group) throw { status: 400, message: 'Nhóm quyền không tồn tại' };
    }

    // Gán quyền theo vai trò MỚI (nextRole), không theo vai trò cũ: nâng nhân viên lên admin thì
    // bỏ nhóm quyền, hạ admin xuống nhân viên thì bắt buộc phải có nhóm quyền để còn chặn được.
    const nextRole = data.role ?? 'staff';
    const updateData: any = {
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      role: nextRole,
      isActive: data.isActive ?? true,
      permissionGroupId: nextRole === 'admin' ? null : (data.permissionGroupId ?? null),
    };

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return { message: 'Cập nhật thành công' };
  }

  /**
   * "Xoá" tài khoản — thực chất luôn là NGỪNG HOẠT ĐỘNG (isActive = false), không xoá dòng dữ liệu.
   *
   * Lý do: tài khoản được tham chiếu ở khắp nơi (người tạo lượt gửi, người thu tiền, người thao
   * tác trong nhật ký). Xoá cứng sẽ làm mất dấu ai đã làm gì — đúng thứ mà nhật ký hoạt động sinh
   * ra để giữ lại.
   *
   * Ba điều kiện chặn:
   *   - Không tự xoá chính mình (tránh tự khoá mình ra khỏi hệ thống).
   *   - Không xoá admin cuối cùng đang hoạt động.
   *   - Không xoá người đang gắn với lượt xe CÒN TRONG BÃI (lượt đó chưa kết thúc).
   */
  async delete(id: number, currentUserId: number) {
    const [user, adminCount, parkedUsage, paymentUsage, activityUsage] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true },
      }),
      prisma.user.count({
        where: { role: 'admin', isActive: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { createdBy: id, status: 'parked' },
        select: { id: true },
      }),
      prisma.payment.findFirst({
        where: { createdBy: id },
        select: { id: true },
      }),
      prisma.userActivityLog.findFirst({
        where: { userId: id },
        select: { id: true },
      }),
    ]);

    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    if (id === currentUserId) {
      throw { status: 400, message: 'Không thể tự xóa tài khoản đang đăng nhập' };
    }

    if (user.role === 'admin' && user.isActive && adminCount <= 1) {
      throw { status: 400, message: 'Không thể xóa admin cuối cùng trong hệ thống' };
    }

    if (parkedUsage) {
      throw { status: 400, message: 'Người dùng đang gắn với lượt xe còn trong bãi, không thể xóa' };
    }

    if (paymentUsage || activityUsage) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return { message: 'Người dùng đã được ngừng hoạt động vì đã phát sinh dữ liệu liên quan' };
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Ngừng hoạt động người dùng thành công' };
  }
}

export const userService = new UserService();
