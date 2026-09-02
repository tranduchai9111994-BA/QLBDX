/**
 * Nghiệp vụ quản lý khách hàng (chủ phương tiện).
 *
 * Vị trí trong luồng:
 *   pages/Customers.tsx -> /api/customers -> customer.controller -> file này -> bảng Customers
 *
 * Khách hàng là gốc của chuỗi liên kết dữ liệu:
 *   Khách hàng -> Phương tiện (biển số) -> Lượt gửi xe -> Phiếu thu
 *              -> Gói dịch vụ đã mua
 * Vì vậy khách hàng chỉ được XOÁ MỀM (ngừng hoạt động), không xoá hẳn khỏi cơ sở dữ liệu.
 */
import prisma from '../config/prisma';
import { CreateCustomerInput, UpdateCustomerInput } from '../validators/customer.validator';

export class CustomerService {
  /**
   * Chuẩn hoá số điện thoại: chỉ giữ lại chữ số.
   * "0912 345 678", "0912-345-678", "0912.345.678" đều quy về "0912345678".
   * Nhờ vậy hai cách gõ khác nhau của cùng một số vẫn bị phát hiện là trùng.
   */
  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  /** Chuẩn hoá CCCD/CMND: bỏ khoảng trắng. Không bắt buộc nhập nên có thể là null. */
  private normalizeIdentityCard(identityCard?: string | null) {
    return identityCard ? identityCard.replace(/\s/g, '') : null;
  }

  /**
   * Danh sách khách hàng.
   *
   * Mặc định CHỈ trả khách đang hoạt động — màn hình chọn khách lúc bán gói không nên hiện
   * khách đã ngừng. Muốn xem cả khách đã ngừng thì truyền `includeInactive` (màn hình quản lý
   * khách hàng) hoặc lọc thẳng bằng `isActive`.
   */
  async findAll(params: { search?: string; isActive?: boolean; includeInactive?: boolean }) {
    const { search, isActive, includeInactive } = params;
    const where: any = {
      ...(!includeInactive && typeof isActive !== 'boolean' ? { isActive: true } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { identityCard: { contains: search } },
        { email: { contains: search } },
      ];
    }

    return prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Chi tiết một khách hàng. Không tìm thấy thì ném 404 để controller trả đúng mã lỗi. */
  async findById(id: number) {
    const customer = await prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw { status: 404, message: 'Không tìm thấy khách hàng' };
    }

    return customer;
  }

  /**
   * Thêm khách hàng mới, có chống trùng số điện thoại và CCCD/CMND.
   *
   * Vì sao phải tự kiểm tra trùng trong mã nguồn thay vì đặt ràng buộc UNIQUE ở cơ sở dữ liệu:
   * ràng buộc UNIQUE so sánh nguyên văn, nên "0912345678" và "0912 345 678" vẫn lọt qua dù là
   * cùng một số. Ở đây so sánh sau khi đã chuẩn hoá nên bắt được cả hai cách gõ.
   */
  async create(data: CreateCustomerInput) {
    const normalizedPhone = this.normalizePhone(data.phone);
    const normalizedIdentityCard = this.normalizeIdentityCard(data.identityCard);
    // Chỉ đối chiếu với khách ĐANG hoạt động: khách cũ đã ngừng thì cho phép dùng lại số điện
    // thoại đó (ví dụ số cũ được cấp lại cho người khác). `select` chỉ lấy 3 cột cần so sánh để
    // không kéo toàn bộ dữ liệu khách hàng về ứng dụng.
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

  /** Cập nhật khách hàng. Cùng quy tắc chống trùng như `create`. */
  async update(id: number, data: UpdateCustomerInput) {
    const normalizedPhone = this.normalizePhone(data.phone);
    const normalizedIdentityCard = this.normalizeIdentityCard(data.identityCard);
    const [customer, existingCustomers] = await Promise.all([
      prisma.customer.findUnique({
        where: { id },
        select: { id: true },
      }),
      // `NOT: { id }` loại chính khách đang sửa ra khỏi danh sách đối chiếu — nếu không, người
      // dùng chỉ sửa mỗi họ tên mà giữ nguyên số điện thoại cũng bị báo "số điện thoại đã tồn tại".
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

  /**
   * NGỪNG HOẠT ĐỘNG khách hàng (xoá mềm) — chỉ đặt isActive = false, KHÔNG xoá dòng dữ liệu.
   *
   * Vì sao xoá mềm: bản ghi gửi xe, phiếu thu và gói đã bán đều tham chiếu tới khách hàng. Xoá
   * cứng sẽ làm hỏng ràng buộc khoá ngoại, hoặc mất luôn lịch sử doanh thu đã phát sinh.
   *
   * Trước khi ngừng còn kiểm tra hai điều kiện chặn, để không bỏ dở nghiệp vụ đang diễn ra:
   *   - Khách còn xe trong bãi -> chưa cho ngừng, phải cho xe ra trước.
   *   - Khách còn gói hiệu lực hoặc chờ áp dụng -> phải xử lý gói trước (khách đã trả tiền).
   */
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
