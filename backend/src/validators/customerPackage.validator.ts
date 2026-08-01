import { z } from 'zod';

export const createCustomerPackageSchema = z.object({
  customerId: z.number().int().positive('CustomerId không hợp lệ'),
  packageId: z.number().int().positive('PackageId không hợp lệ'),
  vehicleId: z.number().int().positive('VehicleId không hợp lệ'),
  startDate: z.string().min(1, 'Vui lòng nhập ngày bắt đầu'),
});

export const updateCustomerPackageSchema = z.object({
  customerId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive().optional(),
  status: z.enum(['active', 'expired', 'pending', 'cancelled']).optional(),
});

export type CreateCustomerPackageInput = z.infer<typeof createCustomerPackageSchema>;
export type UpdateCustomerPackageInput = z.infer<typeof updateCustomerPackageSchema>;
