import prisma from '../config/prisma';
import { CreateCustomerInput, UpdateCustomerInput } from '../validators/customer.validator';

export class CustomerService {
  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  private normalizeIdentityCard(identityCard?: string | null) {
    return identityCard ? identityCard.replace(/\s/g, '') : null;
  }

  async findAll(search?: string) {
    return prisma.customer.findMany({
      where: {
        isActive: true,
        ...(search && {
          OR: [
            { fullName: { contains: search } },
            { phone: { contains: search } },
            { identityCard: { contains: search } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    const customer = await prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw { status: 404, message: 'Không tìm thấy khách hàng' };
    }

    return customer;
  }

  async create(data: CreateCustomerInput) {
    const normalizedPhone = this.normalizePhone(data.phone);
    const normalizedIdentityCard = this.normalizeIdentityCard(data.identityCard);
    const existingCustomers = await prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, phone: true, identityCard: true },
    });

    if (existingCustomers.some((customer) => this.normalizePhone(customer.phone) === normalizedPhone)) {
      throw { status: 400, message: 'Số điện thoại đã tồn tại' };
    }

    if (
      normalizedIdentityCard &&
      existingCustomers.some(
        (customer) => this.normalizeIdentityCard(customer.identityCard) === normalizedIdentityCard
      )
    ) {
      throw { status: 400, message: 'CCCD/CMND đã tồn tại' };
    }

    const customer = await prisma.customer.create({
      data: {
        fullName: data.fullName,
        phone: normalizedPhone,
        email: data.email ?? null,
        address: data.address ?? null,
        identityCard: normalizedIdentityCard,
      },
    });

    return { message: 'Thêm khách hàng thành công', id: customer.id };
  }

  async update(id: number, data: UpdateCustomerInput) {
    const normalizedPhone = this.normalizePhone(data.phone);
    const normalizedIdentityCard = this.normalizeIdentityCard(data.identityCard);
    const [customer, existingCustomers] = await Promise.all([
      prisma.customer.findUnique({
        where: { id },
        select: { id: true },
      }),
      prisma.customer.findMany({
        where: { isActive: true, NOT: { id } },
        select: { id: true, phone: true, identityCard: true },
      }),
    ]);

    if (!customer) {
      throw { status: 404, message: 'Không tìm thấy khách hàng' };
    }

    if (existingCustomers.some((item) => this.normalizePhone(item.phone) === normalizedPhone)) {
      throw { status: 400, message: 'Số điện thoại đã tồn tại' };
    }

    if (
      normalizedIdentityCard &&
      existingCustomers.some((item) => this.normalizeIdentityCard(item.identityCard) === normalizedIdentityCard)
    ) {
      throw { status: 400, message: 'CCCD/CMND đã tồn tại' };
    }

    await prisma.customer.update({
      where: { id },
      data: {
        fullName: data.fullName,
        phone: normalizedPhone,
        email: data.email ?? null,
        address: data.address ?? null,
        identityCard: normalizedIdentityCard,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  async softDelete(id: number) {
    const [customer, activeVehicle, activePackage] = await Promise.all([
      prisma.customer.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      }),
      prisma.vehicle.findFirst({
        where: {
          customerId: id,
          parkingRecords: {
            some: { status: 'parked' },
          },
        },
        select: { id: true },
      }),
      prisma.customerPackage.findFirst({
        where: {
          customerId: id,
          status: { in: ['active', 'pending'] },
        },
        select: { id: true },
      }),
    ]);

    if (!customer) {
      throw { status: 404, message: 'Không tìm thấy khách hàng' };
    }

    if (activeVehicle) {
      throw { status: 400, message: 'Khách hàng đang có xe trong bãi, không thể ngừng hoạt động lúc này' };
    }

    if (activePackage) {
      throw { status: 400, message: 'Khách hàng đang có gói còn hiệu lực hoặc chờ áp dụng, hãy xử lý gói trước' };
    }

    await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Ngừng hoạt động khách hàng thành công' };
  }
}

export const customerService = new CustomerService();
