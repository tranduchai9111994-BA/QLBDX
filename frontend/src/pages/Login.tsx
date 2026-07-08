import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';

interface LoginFormValues {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('Dang nhap thanh cong');
      navigate('/');
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Dang nhap that bai');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #005daa 0%, #0075d5 100%)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, fontWeight: 700,
          }}>P</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--on-surface)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            ParkManager
          </h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', margin: 0 }}>
            Dang nhap de tiep tuc
          </p>
        </div>
        <Form name="login" onFinish={onFinish} size="large" layout="vertical" autoComplete="on">
          <Form.Item name="username" rules={[{ required: true, message: 'Vui long nhap ten dang nhap hoac email' }]}>
            <Input
              prefix={<UserOutlined style={{ color: 'var(--on-surface-variant)' }} />}
              placeholder="Ten dang nhap hoac email"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Vui long nhap mat khau' }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--on-surface-variant)' }} />}
              placeholder="Mat khau"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48, fontSize: '0.95rem', fontWeight: 600 }}>
              Dang nhap
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
