import prisma from '../config/prisma';

export class PaymentService {
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
   * Tổng hợp thu tiền do CHÍNH user hiện tại ghi nhận trong khoảng thời gian (mặc định: hôm nay) —
   * dùng cho nhân viên đối soát tiền mặt cuối ca. Chỉ trả dữ liệu của chính người gọi, không phải
   * doanh thu toàn bãi (khác hẳn findAll ở trên vốn chỉ admin mới xem được).
   */
  async myShiftSummary(userId: number, from?: string, to?: string) {
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
