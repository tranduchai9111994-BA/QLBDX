/**
 * seedPermissionGroups.ts — Tạo nhóm quyền mặc định "Nhân viên tiêu chuẩn" và gán cho các tài
 * khoản staff demo hiện có, để sau khi chuyển từ hệ thống phân quyền cũ (localStorage, không
 * enforce ở backend) sang hệ thống nhóm quyền mới (DB + backend enforce), nhân viên demo không bị
 * "trắng quyền" hoàn toàn.
 *
 * Ma trận mặc định phỏng theo defaultStaffLevel cũ trong permConfig.ts:
 *   - Khách hàng / Phương tiện / Đăng ký gói: full CRUD (cũ = 'full')
 *   - Loại xe / Gói dịch vụ / Bãi đỗ xe: KHÔNG tick gì (cũ = 'view' — chỉ xem, xem vẫn luôn mở
 *     sẵn cho mọi user đăng nhập ở tầng route, không cần dòng quyền)
 *   - Thanh toán / Cảnh báo / Báo cáo: KHÔNG tick gì (cũ = 'hidden')
 *
 * Idempotent: upsert theo tên nhóm, chạy lại an toàn.
 * Chạy: npx ts-node prisma/seedPermissionGroups.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GROUP_NAME = 'Nhân viên tiêu chuẩn';
const FULL_CRUD_SCREENS = ['customers', 'vehicles', 'customer-packages'];

async function main() {
  let group = await prisma.permissionGroup.findUnique({ where: { name: GROUP_NAME } });
  if (!group) {
    group = await prisma.permissionGroup.create({
      data: {
        name: GROUP_NAME,
        description: 'Nhóm quyền mặc định — tương đương quyền staff trước khi có hệ thống nhóm quyền (Khách hàng/Phương tiện/Đăng ký gói: đầy đủ; còn lại: chỉ xem hoặc không truy cập)',
      },
    });
    console.log(`✓ Đã tạo nhóm quyền "${GROUP_NAME}" (id=${group.id})`);
  } else {
    console.log(`✓ Nhóm quyền "${GROUP_NAME}" đã tồn tại (id=${group.id}) — bỏ qua tạo mới`);
  }

  await prisma.groupPermission.deleteMany({ where: { groupId: group.id } });
  await prisma.groupPermission.createMany({
    data: FULL_CRUD_SCREENS.map((screenKey) => ({
      groupId: group!.id,
      screenKey,
      canView: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
    })),
  });
  console.log(`✓ Đã gán quyền đầy đủ cho ${FULL_CRUD_SCREENS.length} màn: ${FULL_CRUD_SCREENS.join(', ')}`);

  const staffUsers = await prisma.user.findMany({
    where: { role: 'staff', permissionGroupId: null },
    select: { id: true, username: true },
  });
  if (staffUsers.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: staffUsers.map((u) => u.id) } },
      data: { permissionGroupId: group.id },
    });
    console.log(`✓ Đã gán ${staffUsers.length} tài khoản staff vào nhóm: ${staffUsers.map((u) => u.username).join(', ')}`);
  } else {
    console.log('✓ Không có tài khoản staff nào cần gán nhóm (đã có nhóm hoặc không có staff)');
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
