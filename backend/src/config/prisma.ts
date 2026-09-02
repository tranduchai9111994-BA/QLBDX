/**
 * Kết nối cơ sở dữ liệu (SQL Server) qua Prisma ORM.
 *
 * Vị trí trong luồng: mọi Service đều `import prisma from '../config/prisma'` để truy vấn DB.
 * Chuỗi kết nối lấy từ DATABASE_URL trong backend/.env; cấu trúc bảng khai báo ở
 * backend/prisma/schema.prisma.
 */
import { PrismaClient } from '@prisma/client';

// Dùng chung MỘT instance PrismaClient cho toàn bộ ứng dụng. Mỗi `new PrismaClient()` mở
// một pool kết nối riêng tới SQL Server, nên nếu mỗi service tự khởi tạo thì số kết nối
// sẽ tăng theo số service và làm cạn connection pool của DB.
const prisma = new PrismaClient();

export default prisma;
