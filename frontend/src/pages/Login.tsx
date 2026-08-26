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
