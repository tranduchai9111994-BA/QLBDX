/**
 * Quy tắc kiểm tra dữ liệu nhóm quyền (Zod).
 */
import { z } from 'zod';
import { CONFIGURABLE_SCREEN_KEYS } from '../config/screens';

export const createPermissionGroupSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên nhóm quyền').max(100),
  description: z.string().max(255).optional().nullable(),
});

export const updatePermissionGroupSchema = createPermissionGroupSchema;

const permissionRowSchema = z.object({
  screenKey: z.enum(CONFIGURABLE_SCREEN_KEYS as [string, ...string[]], {
    errorMap: () => ({ message: 'screenKey không hợp lệ' }),
  }),
  canCreate: z.boolean(),
  canUpdate: z.boolean(),
  canDelete: z.boolean(),
});

export const setPermissionsSchema = z.object({
  permissions: z.array(permissionRowSchema),
});

export type CreatePermissionGroupInput = z.infer<typeof createPermissionGroupSchema>;
export type UpdatePermissionGroupInput = z.infer<typeof updatePermissionGroupSchema>;
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;
