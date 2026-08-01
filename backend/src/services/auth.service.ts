import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { config } from '../config';
import { LoginInput, RegisterInput } from '../validators/auth.validator';

export class AuthService {
  async login(data: LoginInput) {
    const loginValue = data.username.trim();

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { username: loginValue },
          { email: loginValue },
        ],
      },
    });

    if (!user) {
      throw { status: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: 'Tên đăng nhập hoặc mật khẩu không đúng' };
    }

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
      },
    });

    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    return user;
  }

  async updateProfile(userId: number, data: { fullName?: string; email?: string; phone?: string; password?: string }) {
    const updateData: any = {};
    if (data.fullName) updateData.fullName = data.fullName;
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
