import prisma from '../config/prisma';

export interface LogInput {
  userId?: number | null;
  username: string;
  action: string;
  entity?: string | null;
  entityId?: number | null;
  details?: string | null;
  ipAddress?: string | null;
  statusCode?: number | null;
}

export async function logActivity(input: LogInput): Promise<void> {
  try {
    await prisma.userActivityLog.create({ data: input });
  } catch {
    // Ghi log thất bại không được làm gián đoạn luồng chính
  }
}

export class ActivityLogService {
  async findAll(params: {
    page?: number;
    limit?: number;
    userId?: number;
    action?: string;
    entity?: string;
    username?: string;
    from?: string;
    to?: string;
  }) {
    const pageNum = params.page ?? 1;
    const limitNum = Math.min(params.limit ?? 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, any> = {};
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.entity) where.entity = params.entity;
    if (params.username) where.username = { contains: params.username };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const [logs, total] = await Promise.all([
      prisma.userActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: { select: { fullName: true } },
        },
      }),
      prisma.userActivityLog.count({ where }),
    ]);

    return { data: logs, total, page: pageNum, limit: limitNum };
  }
}

export const activityLogService = new ActivityLogService();
