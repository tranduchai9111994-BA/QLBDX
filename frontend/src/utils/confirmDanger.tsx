/**
 * Hộp thoại xác nhận cho các thao tác NGUY HIỂM (xoá, ngừng hoạt động).
 * Gom về một chỗ để mọi thao tác xoá trong hệ thống đều phải xác nhận theo cùng một cách,
 * tránh chỗ nhớ hỏi chỗ quên.
 */
import React from 'react';
import { Modal, message } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import { AxiosError } from 'axios';

interface ConfirmDangerOptions {
  title?: string;
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  /** Hiện thông báo thành công sau khi onConfirm chạy xong (bỏ qua nếu không cần) */
  successMessage?: string;
  errorFallback?: string;
  onConfirm: () => Promise<void>;
}

/**
 * Modal.confirm dùng chung cho các thao tác nguy hiểm (xóa/hủy) — chuẩn hoá icon, màu nút,
 * và cách bắt lỗi (message.error theo response.data.message của backend) thay vì lặp try/catch mỗi trang.
 */
export function confirmDanger({
  title = 'Xác nhận xóa',
  content,
  okText = 'Xóa',
  cancelText = 'Hủy',
  successMessage,
  errorFallback = 'Không thể thực hiện thao tác',
  onConfirm,
}: ConfirmDangerOptions): void {
  Modal.confirm({
    title,
    content,
    okText,
    cancelText,
    okButtonProps: { danger: true },
    icon: <ExclamationCircleFilled style={{ color: 'var(--error)' }} />,
    onOk: async () => {
      try {
        await onConfirm();
        if (successMessage) message.success(successMessage);
      } catch (err) {
        const error = err as AxiosError<{ message: string }>;
        message.error(error.response?.data?.message || errorFallback);
      }
    },
  });
}
