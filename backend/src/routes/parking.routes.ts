/**
 * Định tuyến nhóm API vận hành bãi xe. Tiền tố đầy đủ: /api/parking
 */
import { Router } from 'express';
import { parkingController } from '../controllers/parking.controller';
import { validate } from '../middlewares/validate';
import {
  parkingEntrySchema,
  parkingExitExceptionSchema,
  parkingExitSchema,
} from '../validators/parking.validator';
import { auth } from '../middlewares/auth';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();

// ── Nhóm chỉ ĐỌC dữ liệu: chỉ cần đăng nhập, không ghi nhật ký (tránh phình bảng log) ──────
router.get('/', auth, (req, res) => parkingController.findAll(req, res));
router.get('/history', auth, (req, res) => parkingController.history(req, res));
router.get('/plate-history/:plate', auth, (req, res) => parkingController.plateHistory(req, res));
router.get('/smart-lookup/:plate', auth, (req, res) => parkingController.smartLookup(req, res));

// ── Nhóm THAY ĐỔI dữ liệu: thêm activityLogger để lưu vết ai thao tác, và validate body ─────
// Chuỗi middleware chạy lần lượt: auth (đã đăng nhập chưa) -> activityLogger (đăng ký ghi log
// khi phản hồi xong) -> validate (dữ liệu có hợp lệ không) -> controller.
router.post('/entry', auth, activityLogger('ParkingRecords'), validate(parkingEntrySchema), (req, res) => parkingController.entry(req, res));
router.post('/exit', auth, activityLogger('ParkingRecords'), validate(parkingExitSchema), (req, res) => parkingController.exit(req, res));
router.post('/exit-exception', auth, activityLogger('ParkingRecords'), validate(parkingExitExceptionSchema), (req, res) => parkingController.exitException(req, res));
// Đặt '/:id/preview' CUỐI CÙNG. Express so khớp route theo thứ tự khai báo, nên nếu đặt các
// route tĩnh như '/history' sau mẫu có tham số thì '/history' sẽ bị hiểu là một giá trị :id.
router.get('/:id/preview', auth, (req, res) => parkingController.preview(req, res));

export default router;
