import prisma from '../config/prisma';
import { CONFIGURABLE_SCREENS } from '../config/screens';
import { CreatePermissionGroupInput, SetPermissionsInput, UpdatePermissionGroupInput } from '../validators/permissionGroup.validator';

export class PermissionGroupService {
  screens() {
    return CONFIGURABLE_SCREENS;
  }

  async findAll() {
    return prisma.permissionGroup.findMany({
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const group = await prisma.permissionGroup.findUnique({
      where: { id },
      include: { permissions: true, _count: { select: { users: true } } },
    });
    if (!group) throw { status: 404, message: 'Không tìm thấy nhóm quyền' };
    return group;
  }

  async create(data: CreatePermissionGroupInput) {
    const existing = await prisma.permissionGroup.findUnique({ where: { name: data.name } });
    if (existing) throw { status: 400, message: 'Tên nhóm quyền đã tồn tại' };

    return prisma.permissionGroup.create({
      data: { name: data.name, description: data.description ?? null },
    });
  }

  async update(id: number, data: UpdatePermissionGroupInput) {
    await this.findOne(id);
    const duplicate = await prisma.permissionGroup.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (duplicate) throw { status: 400, message: 'Tên nhóm quyền đã tồn tại' };

    return prisma.permissionGroup.update({
      where: { id },
      data: { name: data.name, description: data.description ?? null },
    });
  }

  async delete(id: number) {
    await this.findOne(id);
    const usersInGroup = await prisma.user.count({ where: { permissionGroupId: id } });
    if (usersInGroup > 0) {
      throw { status: 400, message: `Còn ${usersInGroup} tài khoản thuộc nhóm này — chuyển nhóm khác trước khi xoá` };
    }
    await prisma.permissionGroup.delete({ where: { id } });
    return { message: 'Đã xoá nhóm quyền' };
  }

  /** Ghi đè toàn bộ ma trận quyền của 1 nhóm (xoá cũ, tạo lại theo mảng gửi lên — đơn giản và
   * luôn nhất quán hơn so với diff từng dòng). */
  async setPermissions(groupId: number, data: SetPermissionsInput) {
    await this.findOne(groupId);

    await prisma.$transaction([
      prisma.groupPermission.deleteMany({ where: { groupId } }),
      prisma.groupPermission.createMany({
        // canView không có ô tick riêng ở UI (ma trận chỉ có Thêm/Sửa/Xóa theo yêu cầu) — Xem dữ
        // liệu tra cứu đã mở sẵn cho mọi user đăng nhập ở tầng route, cột này giữ lại trong DB chỉ
        // để dự phòng mở rộng sau, luôn ghi true cho mọi dòng có trong ma trận.
        data: data.permissions.map((p) => ({
          groupId,
          screenKey: p.screenKey,
          canView: true,
          canCreate: p.canCreate,
          canUpdate: p.canUpdate,
          canDelete: p.canDelete,
        })),
      }),
    ]);

    return this.findOne(groupId);
  }
}

export const permissionGroupService = new PermissionGroupService();
