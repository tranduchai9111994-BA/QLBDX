/**
 * Màn hình THÔNG TIN CÁ NHÂN — người dùng tự xem và sửa hồ sơ, đổi mật khẩu.
 *
 * Gọi GET/PUT /api/auth/me. Backend lấy id từ token chứ không nhận từ client, nên không thể
 * sửa hồ sơ người khác qua màn hình này.
 */
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Descriptions, Tag, Divider } from 'antd';
import { SaveOutlined, LockOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface ProfileData {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
}

const Profile: React.FC = () => {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get<ProfileData>('/auth/me');
      setProfile(res.data);
      infoForm.setFieldsValue({
        fullName: res.data.fullName,
        email: res.data.email,
        phone: res.data.phone,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleUpdateInfo = async (values: { fullName: string; email?: string; phone?: string }) => {
    setSaving(true);
    try {
      await api.put('/auth/me', values);
      message.success('Cập nhật thông tin thành công');
      fetchProfile();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (values: { password: string }) => {
    setSaving(true);
    try {
      await api.put('/auth/me', { password: values.password });
      message.success('Đổi mật khẩu thành công');
      pwForm.resetFields();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">Thông tin cá nhân</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <Card title="Thông tin tài khoản" style={{ flex: 1, minWidth: 350 }} loading={loading}>
          {profile && (
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Tên đăng nhập">{profile.username}</Descriptions.Item>
              <Descriptions.Item label="Vai trò">
                {profile.role === 'admin' ? <Tag color="red">Admin</Tag> : <Tag color="blue">Nhân viên</Tag>}
              </Descriptions.Item>
            </Descriptions>
          )}
          <Divider>Chỉnh sửa thông tin</Divider>
          <Form form={infoForm} layout="vertical" onFinish={handleUpdateInfo}>
            <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Số điện thoại">
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              Lưu thông tin
            </Button>
          </Form>
        </Card>

        <Card title="Đổi mật khẩu" style={{ flex: 1, minWidth: 350 }}>
          <Form form={pwForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item name="password" label="Mật khẩu mới" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }, { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Xác nhận mật khẩu"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<LockOutlined />} loading={saving}>
              Đổi mật khẩu
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
