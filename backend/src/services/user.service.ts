import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { CreateUserInput, UpdateUserInput } from '../validators/user.validator';

export class UserService {
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

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
      },
    });

    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    return user;
  }

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
      },
    });

    return { message: 'Tạo người dùng thành công', id: user.id };
  }

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

    const updateData: any = {
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      role: data.role ?? 'staff',
      isActive: data.isActive ?? true,
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
