/**
 * Nghiệp vụ thanh toán: tra cứu giao dịch, sửa giao dịch ghi sai, và tổng hợp thu tiền theo ca.
 *
 * Vị trí trong luồng: phiếu thu được sinh TỰ ĐỘNG khi cho xe ra (parking.service.ts -> completeExit)
 * hoặc khi khách mua gói (customerPackage.service.ts). File này chỉ phục vụ việc tra cứu và
 * chỉnh sửa sau đó, không tự tạo giao dịch mới.
 */
import prisma from '../config/prisma';
import { UpdatePaymentInput } from '../validators/payment.validator';

export class PaymentService {
  /**
   * Danh sách giao dịch thanh toán toàn hệ thống, có phân trang và nhiều bộ lọc.
   * Dùng cho màn hình Thanh toán (pages/Payments.tsx) — chỉ admin xem được.
   */
  async findAll(params: {
    fromDate?: string;
    toDate?: string;
    paymentMethod?: string;
    paymentType?: string;
    search?: string;
    minAmount?: number;
    maxAmount?: number;
    page?: number;
    pageSize?: number;
  }) {
    const { fromDate, toDate, paymentMethod, paymentType, search, minAmount, maxAmount } = params;
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20;
    const paidAt: Record<string, Date> = {};
    if (fromDate) paidAt.gte = new Date(fromDate);
    // Ghép thêm 23:59:59.999 vào ngày kết thúc: người dùng chọn "đến ngày 30/9" thì phải lấy
    // trọn cả ngày 30/9. Nếu để nguyên "2026-09-30" thì Date hiểu là 00:00 và bỏ sót cả ngày đó.
    if (toDate) paidAt.lte = new Date(toDate + 'T23:59:59.999');

    const where = {
      ...(Object.keys(paidAt).length > 0 && { paidAt }),
      ...(paymentMethod && { paymentMethod }),
      ...(paymentType && { paymentType }),
      ...((typeof minAmount === 'number' || typeof maxAmount === 'number')
        ? {
            amount: {
              ...(typeof minAmount === 'number' ? { gte: minAmount } : {}),
              ...(typeof maxAmount === 'number' ? { lte: maxAmount } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { parkingRecord: { licensePlate: { contains: search } } },
              { customerPackage: { vehicle: { licensePlate: { contains: search } } } },
              { creator: { fullName: { contains: search } } },
            ],
          }
        : {}),
    };

    // Lấy dữ liệu trang hiện tại và đếm tổng số bản ghi song song, dùng chung biến `where` để
    // hai truy vấn không bao giờ lệch bộ lọc.
    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          creator: { select: { fullName: true } },
          parkingRecord: {
            select: { licensePlate: true, entryTime: true, exitTime: true },
          },
          customerPackage: {
            select: {
              vehicle: { select: { licensePlate: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * Cho phép admin sửa lại giao dịch đã ghi nhận sai (nhầm số tiền, sai phương thức thanh toán).
   *
   * Cố ý KHÔNG cho xoá giao dịch: dữ liệu thu tiền phải giữ được vết để đối soát. Sai thì sửa và
   * ghi chú lý do, mọi lần sửa đều được middleware activityLogger lưu vào Nhật ký hoạt động.
   */
  async update(id: number, data: UpdatePaymentInput) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      throw { status: 404, message: 'Không tìm thấy giao dịch thanh toán' };
    }

    return prisma.payment.update({
      where: { id },
      data: {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.notes ?? null,
      },
      include: {
        creator: { select: { fullName: true } },
        parkingRecord: { select: { licensePlate: true, entryTime: true, exitTime: true } },
        customerPackage: { select: { vehicle: { select: { licensePlate: true } } } },
      },
    });
  }

  /**
   * Tổng hợp thu tiền do CHÍNH user hiện tại ghi nhận trong khoảng thời gian (mặc định: hôm nay) —
   * dùng cho nhân viên đối soát tiền mặt cuối ca. Chỉ trả dữ liệu của chính người gọi, không phải
   * doanh thu toàn bãi (khác hẳn findAll ở trên vốn chỉ admin mới xem được).
   */
  async myShiftSummary(userId: number, from?: string, to?: string) {
    // Không truyền khoảng thời gian thì mặc định lấy từ 00:00 hôm nay tới hiện tại — đúng nhu cầu
    // "chốt ca hôm nay" của nhân viên.
    const start = from ? new Date(from) : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const end = to ? new Date(to) : new Date();

    const payments = await prisma.payment.findMany({
      where: {
        createdBy: userId,
        status: 'completed',
        paidAt: { gte: start, lte: end },
      },
      select: { amount: true, paymentMethod: true, paymentType: true },
    });

    // Gộp theo phương thức thanh toán để nhân viên đối chiếu: riêng phần tiền mặt mới phải đếm
    // tiền trong két, phần thẻ và chuyển khoản đối soát với sao kê ngân hàng.
    const methodLabel: Record<string, string> = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản' };
    const byMethodMap = new Map<string, { totalAmount: number; totalTransactions: number }>();
    for (const p of payments) {
      const cur = byMethodMap.get(p.paymentMethod) || { totalAmount: 0, totalTransactions: 0 };
      cur.totalAmount += Number(p.amount);
      cur.totalTransactions += 1;
      byMethodMap.set(p.paymentMethod, cur);
    }

    return {
      from: start,
      to: end,
      totalAmount: payments.reduce((s, p) => s + Number(p.amount), 0),
      totalTransactions: payments.length,
      byMethod: Array.from(byMethodMap.entries()).map(([method, v]) => ({
        method,
        label: methodLabel[method] || method,
        ...v,
      })),
    };
  }
}

export const paymentService = new PaymentService();
