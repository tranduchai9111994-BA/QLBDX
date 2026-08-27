import prisma from '../config/prisma';
import { CreatePackageInput, SchedulePriceChangeInput, UpdatePackageInput } from '../validators/package.validator';
import { syncDuePackagePrices } from './pricing.service';
import { formatDateVN } from '../utils/formatDate';

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

    await syncDuePackagePrices();

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
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
      },
    });

    return { message: 'Thêm gói dịch vụ thành công', id: pkg.id };
  }

  async update(id: number, data: UpdatePackageInput, changedBy?: number) {
    await syncDuePackagePrices();

    const [pkg, vehicleType, duplicatePackage, packageUsage] = await Promise.all([
      prisma.parkingPackage.findUnique({
        where: { id },
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
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
      },
    });

    // Giá đổi qua form sửa thông tin -> áp dụng ngay, vẫn lưu lịch sử để audit.
    // Muốn đặt lịch cho tương lai -> dùng schedulePriceChange().
    if (Number(pkg.price) !== data.price) {
      await prisma.packagePriceHistory.create({
        data: {
          packageId: id,
          price: data.price,
          effectiveFrom: new Date(),
          changedBy: changedBy ?? null,
        },
      });
      await syncDuePackagePrices();
    }

    return { message: 'Cập nhật thành công' };
  }

  /** Đặt lịch đổi giá gói — effectiveFrom có thể ở tương lai, hệ thống tự áp dụng đúng ngày. */
  async schedulePriceChange(id: number, data: SchedulePriceChangeInput, changedBy?: number) {
    const pkg = await prisma.parkingPackage.findUnique({ where: { id }, select: { id: true } });
    if (!pkg) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ' };
    }

    const effectiveFrom = new Date(data.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw { status: 400, message: 'Ngày hiệu lực không hợp lệ' };
    }

    await prisma.packagePriceHistory.create({
      data: {
        packageId: id,
        price: data.price,
        effectiveFrom,
        changedBy: changedBy ?? null,
      },
    });

    if (effectiveFrom <= new Date()) {
      await syncDuePackagePrices();
      return { message: 'Đã cập nhật giá mới (áp dụng ngay lập tức)' };
    }
    return {
      message: `Đã đặt lịch đổi giá — sẽ tự động áp dụng từ ${formatDateVN(effectiveFrom)}`,
    };
  }

  async getPriceHistory(id: number) {
    return prisma.packagePriceHistory.findMany({
      where: { packageId: id },
      include: { changer: { select: { fullName: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
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
