import prisma from '../config/prisma';
import { CreateCustomerPackageInput } from '../validators/customerPackage.validator';
import { getPackageLifecycleStatus } from '../utils/businessRules';

export class CustomerPackageService {
  private async syncExpiredStatuses(now = new Date()) {
    await prisma.customerPackage.updateMany({
      where: {
        status: { in: ['active', 'pending'] },
        endDate: { lt: now },
      },
      data: { status: 'expired' },
    });
  }

  private getRuntimeStatus(pkg: { status: string; startDate: Date; endDate: Date }, now = new Date()) {
    return getPackageLifecycleStatus(pkg.status, pkg.startDate, pkg.endDate, now);
  }

  private async ensurePackageCreateValidity(data: CreateCustomerPackageInput, startDate: Date, endDate: Date) {
    const [customer, vehicle, pkg, overlappingPackage] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: data.customerId, isActive: true },
        select: { id: true },
      }),
      prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
        select: { id: true, customerId: true, vehicleTypeId: true, licensePlate: true },
      }),
      prisma.parkingPackage.findUnique({
        where: { id: data.packageId },
      }),
      prisma.customerPackage.findFirst({
        where: {
          vehicleId: data.vehicleId,
          status: { not: 'cancelled' },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      }),
    ]);

    if (!customer) {
      throw { status: 400, message: 'Khách hàng không tồn tại hoặc đã ngừng hoạt động' };
    }

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy phương tiện' };
    }

    if (vehicle.customerId !== data.customerId) {
      throw { status: 400, message: 'Phương tiện không thuộc khách hàng đã chọn' };
    }

    if (!pkg) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ' };
    }

    if (!pkg.isActive) {
      throw { status: 400, message: 'Gói dịch vụ này đã ngừng áp dụng' };
    }

    if (vehicle.vehicleTypeId !== pkg.vehicleTypeId) {
      throw { status: 400, message: 'Loại xe không khớp với gói dịch vụ đã chọn' };
    }

    if (overlappingPackage) {
      throw { status: 400, message: 'Xe đã có một gói trùng thời gian hiệu lực, không thể đăng ký chồng' };
    }

    return { vehicle, pkg };
  }

  async findAll(customerId?: number, status?: string) {
    await this.syncExpiredStatuses();

    const packages = await prisma.customerPackage.findMany({
      where: {
        ...(customerId && { customerId }),
      },
      include: {
        customer: { select: { fullName: true, phone: true } },
        parkingPackage: { select: { name: true, price: true } },
        vehicle: { select: { licensePlate: true, vehicleTypeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return packages
      .map((pkg) => ({
        ...pkg,
        status: this.getRuntimeStatus(pkg),
      }))
      .filter((pkg) => !status || pkg.status === status);
  }

  async create(data: CreateCustomerPackageInput, createdByUserId: number) {
    await this.syncExpiredStatuses();

    const startDate = new Date(data.startDate);
    startDate.setHours(0, 0, 0, 0);
    const { pkg } = await this.ensurePackageCreateValidity(data, startDate, startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + pkg.durationDays);
    endDate.setHours(23, 59, 59, 999);

    await this.ensurePackageCreateValidity(data, startDate, endDate);
    const status = this.getRuntimeStatus({ status: 'active', startDate, endDate });

    const customerPackage = await prisma.customerPackage.create({
      data: {
        customerId: data.customerId,
        packageId: data.packageId,
        vehicleId: data.vehicleId,
        startDate,
        endDate,
        status,
      },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        customerPackageId: customerPackage.id,
        amount: pkg.price,
        paymentType: 'package',
        createdBy: createdByUserId,
      },
    });

    return { message: 'Đăng ký gói thành công', id: customerPackage.id };
  }

  async update(id: number, data: { customerId?: number; vehicleId?: number; status?: string }) {
    await this.syncExpiredStatuses();

    const currentPackage = await prisma.customerPackage.findUnique({
      where: { id },
      include: {
        parkingPackage: {
          select: { vehicleTypeId: true },
        },
      },
    });

    if (!currentPackage) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ khách hàng' };
    }

    const nextCustomerId = data.customerId ?? currentPackage.customerId;
    const nextVehicleId = data.vehicleId ?? currentPackage.vehicleId;
    const nextStatus = data.status ?? currentPackage.status;

    const [customer, vehicle] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: nextCustomerId, isActive: true },
        select: { id: true },
      }),
      prisma.vehicle.findUnique({
        where: { id: nextVehicleId },
        select: { id: true, customerId: true, vehicleTypeId: true },
      }),
    ]);

    if (!customer) {
      throw { status: 400, message: 'Khách hàng không tồn tại hoặc đã ngừng hoạt động' };
    }

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy phương tiện' };
    }

    if (vehicle.customerId !== nextCustomerId) {
      throw { status: 400, message: 'Phương tiện không thuộc khách hàng đã chọn' };
    }

    if (vehicle.vehicleTypeId !== currentPackage.parkingPackage.vehicleTypeId) {
      throw { status: 400, message: 'Phương tiện không cùng loại với gói dịch vụ hiện tại' };
    }

    const runtimeStatus = this.getRuntimeStatus(currentPackage);
    if (runtimeStatus === 'active' && nextStatus === 'pending') {
      throw { status: 400, message: 'Gói đang có hiệu lực, không thể chuyển về trạng thái chờ áp dụng' };
    }

    await prisma.customerPackage.update({
      where: { id },
      data: {
        customerId: nextCustomerId,
        vehicleId: nextVehicleId,
        status: nextStatus,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  async delete(id: number) {
    const customerPackage = await prisma.customerPackage.findUnique({
      where: { id },
      include: {
        payments: { select: { id: true } },
      },
    });

    if (!customerPackage) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ khách hàng' };
    }

    const runtimeStatus = this.getRuntimeStatus(customerPackage);
    if (runtimeStatus === 'active' || runtimeStatus === 'pending') {
      throw { status: 400, message: 'Gói đang còn hiệu lực hoặc chưa tới ngày áp dụng, hãy chuyển sang hủy thay vì xóa' };
    }

    if (customerPackage.payments.length > 0) {
      throw { status: 400, message: 'Gói đã phát sinh thanh toán, không thể xóa cứng' };
    }

    await prisma.customerPackage.delete({
      where: { id },
    });

    return { message: 'Xóa gói dịch vụ thành công' };
  }

  async checkActivePackage(vehicleId: number) {
    await this.syncExpiredStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activePackage = await prisma.customerPackage.findFirst({
      where: {
        vehicleId,
        status: { not: 'cancelled' },
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        parkingPackage: { select: { name: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    const daysUntilExpiry = activePackage
      ? Math.ceil(
          (new Date(activePackage.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      hasPackage: !!activePackage,
      package: activePackage
        ? {
            ...activePackage,
            status: this.getRuntimeStatus(activePackage),
          }
        : null,
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= 7,
    };
  }
}

export const customerPackageService = new CustomerPackageService();
