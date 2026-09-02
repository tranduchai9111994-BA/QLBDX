/**
 * Điểm khởi động của ứng dụng React — file chạy đầu tiên phía frontend.
 *
 * Chuỗi khởi động:
 *   public/index.html (<div id="root">) -> index.tsx (file này) -> App.tsx -> các trang
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './design-system.css';
import App from './App';

// createRoot là cách khởi tạo của React 18: React sẽ quản lý toàn bộ cây giao diện bên trong
// thẻ <div id="root"> của public/index.html. Ép kiểu `as HTMLElement` vì getElementById có thể
// trả null, nhưng ở đây phần tử luôn tồn tại trong file HTML gốc.
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<App />);
