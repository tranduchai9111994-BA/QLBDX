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
  }) {
    const { fromDate, toDate, paymentMethod, paymentType, search, minAmount, maxAmount } = params;
    const paidAt: Record<string, Date> = {};
    if (fromDate) paidAt.gte = new Date(fromDate);
    if (toDate) paidAt.lte = new Date(toDate + 'T23:59:59.999');

    return prisma.payment.findMany({
      where: {
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
      },
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
    });
  }
}

export const paymentService = new PaymentService();
