/**
 * Màn hình THÔNG TIN CÁ NHÂN — người dùng tự xem và sửa hồ sơ, đổi mật khẩu.
 *
 * Gọi GET/PUT /api/auth/me. Backend lấy id từ token chứ không nhận từ client, nên không thể
 * sửa hồ sơ người khác qua màn hình này.
 *
 * Bố cục: hai thẻ Card cạnh nhau, mỗi thẻ MỘT form riêng
 *   Card trái  - thông tin tài khoản (họ tên / email / điện thoại)
 *   Card phải  - đổi mật khẩu
 * Vì sao hai form tách rời chứ không gộp một: đổi mật khẩu không nên bắt người dùng nhập lại
 * cả họ tên, và ngược lại sửa số điện thoại không nên đòi nhập mật khẩu. Mỗi form gửi đi một
 * phần dữ liệu - backend (auth.service.updateProfile) chỉ ghi những field thực sự có trong body,
 * nên gửi thiếu field KHÔNG làm xoá trắng field còn lại.
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
  // Hai instance form TÁCH BIỆT: nếu dùng chung một `form` thì resetFields() sau khi đổi mật khẩu
  // sẽ xoá luôn các ô họ tên/email đang hiển thị ở Card bên cạnh.
  const [infoForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  /**
   * Tải hồ sơ từ server rồi đổ vào form.
   * Không lấy từ `user` trong AuthContext vì context chỉ giữ vài field cơ bản để hiện tên ở góc
   * phải màn hình, không có đủ email/điện thoại.
   */
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get<ProfileData>('/auth/me');
      setProfile(res.data);
      // Đổ dữ liệu vào form sau khi có phản hồi. Chỉ set ba field cho phép sửa - username và
      // role cố ý KHÔNG đưa vào form, chỉ hiện ở phần Descriptions bên trên dạng chỉ đọc.
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

  // Mảng phụ thuộc rỗng -> chỉ chạy một lần khi mở màn hình.
  useEffect(() => { fetchProfile(); }, []);

  /**
   * Lưu thông tin cá nhân. Sau khi lưu gọi lại fetchProfile() để màn hình hiện đúng dữ liệu
   * server đã ghi, thay vì tin vào giá trị vừa gõ (server có thể đã chuẩn hoá lại).
   */
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

  /**
   * Đổi mật khẩu. Chỉ gửi đúng field `password` - backend băm bcrypt rồi ghi vào passwordHash.
   *
   * Mật khẩu KHÔNG bao giờ được băm ở frontend: nếu băm ở đây thì chuỗi băm trở thành mật khẩu
   * thật, ai bắt được gói tin là đăng nhập lại được mà không cần biết mật khẩu gốc.
   */
  const handleChangePassword = async (values: { password: string }) => {
    setSaving(true);
    try {
      await api.put('/auth/me', { password: values.password });
      message.success('Đổi mật khẩu thành công');
      // Xoá trắng ô mật khẩu sau khi đổi xong, tránh để mật khẩu mới nằm hiển thị trên màn hình.
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
            {/* Ô xác nhận mật khẩu. `dependencies={['password']}` bắt buộc phải có: nó báo cho
                Ant Design kiểm tra lại ô này mỗi khi ô `password` đổi. Thiếu dòng đó thì người
                dùng gõ khớp rồi mới sửa mật khẩu gốc sẽ KHÔNG bị báo lệch nữa. */}
            <Form.Item
              name="confirmPassword"
              label="Xác nhận mật khẩu"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                // Luật tự viết để so hai ô với nhau. Trả Promise.resolve() = hợp lệ,
                // Promise.reject(Error) = hiện dòng lỗi đỏ dưới ô nhập.
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
