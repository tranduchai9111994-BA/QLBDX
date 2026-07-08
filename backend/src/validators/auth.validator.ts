import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Vui long nhap ten dang nhap hoac email'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
});

export const registerSchema = z.object({
  username: z.string().min(1, 'Vui long nhap ten dang nhap'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  fullName: z.string().min(1, 'Vui long nhap ho ten'),
  email: z.string().email('Email khong hop le').optional().nullable(),
  phone: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
