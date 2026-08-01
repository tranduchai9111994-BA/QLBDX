import prisma from '../config/prisma';
import { CreatePackageInput, UpdatePackageInput } from '../validators/package.validator';

export class PackageService {
  async findAll(params: {
    search?: string;
    vehicleTypeId?: number;
    isActive?: boolean;
    includeInactive?: boolean;
    minPrice?: number;
    maxPrice?: number;
    minDuration?: number;
    maxDuration?: number;
  }) {
    const {
      search,
      vehicleTypeId,
      isActive,
      includeInactive,
      minPrice,
      maxPrice,
      minDuration,
      maxDuration,
    } = params;

    return prisma.parkingPackage.findMany({
      where: {
        ...(!includeInactive && typeof isActive !== 'boolean' ? { isActive: true } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(vehicleTypeId ? { vehicleTypeId } : {}),
        ...((typeof minPrice === 'number' || typeof maxPrice === 'number')
          ? {
              price: {
                ...(typeof minPrice === 'number' ? { gte: minPrice } : {}),
                ...(typeof maxPrice === 'number' ? { lte: maxPrice } : {}),
              },
            }
          : {}),
        ...((typeof minDuration === 'number' || typeof maxDuration === 'number')
          ? {
              durationDays: {
                ...(typeof minDuration === 'number' ? { gte: minDuration } : {}),
                ...(typeof maxDuration === 'number' ? { lte: maxDuration } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { vehicleType: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      include: {
        vehicleType: { select: { name: true } },
      },
      orderBy: [{ vehicleTypeId: 'asc' }, { durationDays: 'asc' }],
    });
  }

  async create(data: CreatePackageInput) {
    const [vehicleType, duplicatePackage] = await Promise.all([
      prisma.vehicleType.findUnique({
        where: { id: data.vehicleTypeId },
        select: { id: true },
      }),
      prisma.parkingPackage.findFirst({
        where: {
          name: data.name,
          vehicleTypeId: data.vehicleTypeId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);

    if (!vehicleType) {
      throw { status: 400, message: 'Loại xe không tồn tại' };
    }

    if (duplicatePackage) {
      throw { status: 400, message: 'Gói dịch vụ cùng tên cho loại xe này đã tồn tại' };
    }

    const pkg = await prisma.parkingPackage.create({
      data: {
        name: data.name,
        vehicleTypeId: data.vehicleTypeId,
        durationDays: data.durationDays,
        price: data.price,
        description: data.description ?? null,
      },
    });

    return { message: 'Thêm gói dịch vụ thành công', id: pkg.id };
  }

  async update(id: number, data: UpdatePackageInput) {
    const [pkg, vehicleType, duplicatePackage, packageUsage] = await Promise.all([
      prisma.parkingPackage.findUnique({
        where: { id },
        select: { id: true, vehicleTypeId: true },
      }),
      prisma.vehicleType.findUnique({
        where: { id: data.vehicleTypeId },
        select: { id: true },
      }),
      prisma.parkingPackage.findFirst({
        where: {
          name: data.name,
          vehicleTypeId: data.vehicleTypeId,
          NOT: { id },
        },
        select: { id: true },
      }),
      prisma.customerPackage.findFirst({
        where: { packageId: id },
        select: { id: true },
      }),
    ]);

    if (!pkg) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ' };
    }

    if (!vehicleType) {
      throw { status: 400, message: 'Loại xe không tồn tại' };
    }

    if (duplicatePackage) {
      throw { status: 400, message: 'Gói dịch vụ cùng tên cho loại xe này đã tồn tại' };
    }

    if (packageUsage && pkg.vehicleTypeId !== data.vehicleTypeId) {
      throw { status: 400, message: 'Gói đã được đăng ký, không thể đổi loại xe của gói' };
    }

    await prisma.parkingPackage.update({
      where: { id },
      data: {
        name: data.name,
        vehicleTypeId: data.vehicleTypeId,
        durationDays: data.durationDays,
        price: data.price,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  async delete(id: number) {
    const [pkg, customerPackageUsage] = await Promise.all([
      prisma.parkingPackage.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      }),
      prisma.customerPackage.findFirst({
        where: { packageId: id },
        select: { id: true },
      }),
    ]);

    if (!pkg) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ' };
    }

    if (customerPackageUsage) {
      throw { status: 400, message: 'Gói đã phát sinh đăng ký/thanh toán, hãy chuyển sang ngừng áp dụng thay vì xóa' };
    }

    await prisma.parkingPackage.delete({
      where: { id },
    });

    return { message: 'Xóa gói dịch vụ thành công' };
  }
}

export const packageService = new PackageService();
