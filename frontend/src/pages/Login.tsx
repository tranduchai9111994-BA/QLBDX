/**
 * Màn hình ĐĂNG NHẬP — cửa vào của hệ thống, cũng là trang duy nhất không cần token.
 *
 * Vị trí trong luồng:
 *   Người dùng nhập tài khoản -> AuthContext.login() -> POST /api/auth/login
 *     -> backend so khớp mật khẩu bcrypt, cấp JWT -> lưu token -> chuyển về trang Tổng quan
 *
 * Tài khoản demo (xem docs/demo_accounts.md): admin/admin123, nhanvien1/staff123.
 */
import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Segmented } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';

interface LoginFormValues {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const { login } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Xử lý khi bấm nút Đăng nhập.
   *
   * `login()` của AuthContext lo phần gọi API và lưu phiên; ở đây chỉ quản lý trạng thái nút và
   * hiển thị thông báo. Backend cố tình trả cùng một câu lỗi cho cả trường hợp sai tài khoản lẫn
   * sai mật khẩu, nên thông báo hiển thị ở đây cũng chỉ có một mức chung.
   */
  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success(lang === 'en' ? 'Login successful' : 'Đăng nhập thành công');
      navigate('/');
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || (lang === 'en' ? 'Login failed' : 'Đăng nhập thất bại'));
    } finally {
      // Đặt trong `finally` để nút luôn thoát trạng thái chờ, kể cả khi đăng nhập lỗi — nếu để
      // trong nhánh try thì đăng nhập sai một lần là nút kẹt quay vòng mãi.
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        {/* Language switcher on login page */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Segmented
            value={lang}
            onChange={(v) => setLang(v as 'vi' | 'en')}
            options={[
              { value: 'vi', label: '🇻🇳 Tiếng Việt' },
              { value: 'en', label: '🇬🇧 English' },
            ]}
            size="small"
          />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo192.png"
            alt=""
            style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 12, display: 'block' }}
          />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--on-surface)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Quản lý bãi đỗ xe
          </h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
            {lang === 'en' ? 'Sign in to continue' : 'Đăng nhập để tiếp tục'}
          </p>
        </div>
        <Form name="login" onFinish={onFinish} size="large" layout="vertical" autoComplete="on">
          <Form.Item name="username" rules={[{ required: true, message: lang === 'en' ? 'Please enter your username' : 'Vui lòng nhập tên đăng nhập' }]}>
            <Input
              prefix={<UserOutlined style={{ color: 'var(--on-surface-variant)' }} />}
              placeholder={t('loginUsername')}
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: lang === 'en' ? 'Please enter your password' : 'Vui lòng nhập mật khẩu' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--on-surface-variant)' }} />}
              placeholder={t('loginPassword')}
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48, fontSize: '0.95rem', fontWeight: 600 }}>
              {t('loginBtn')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
