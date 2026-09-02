/**
 * Hook phát hiện đã có phiên bản giao diện mới được triển khai và mời người dùng tải lại trang.
 * Cần thiết vì nhân viên thường mở ứng dụng suốt ca làm việc, không tự tải lại bao giờ.
 */
import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 60_000;
const BASELINE_KEY = 'qlbdx_build_version_baseline';

interface BuildInfo {
  version: string;
}

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/build-info.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: BuildInfo = (await res.json()) as BuildInfo;
    return data.version;
  } catch {
    return null;
  }
}

/**
 * Phát hiện khi có bản build mới (public/build-info.json đổi version) trong khi tab đang mở,
 * để hiện icon "có bản cập nhật" thay vì người dùng phải tự tắt/mở lại app.
 *
 * Baseline lưu ở sessionStorage (không phải useRef) — sống sót qua remount do HMR/StrictMode
 * trong lúc dev, chỉ thực sự reset khi tab được tải lại (đúng lúc baseline cần đổi theo).
 */
export function useUpdateAvailable() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const latest = await fetchVersion();
      if (!latest || cancelled) return;

      const baseline = sessionStorage.getItem(BASELINE_KEY);
      if (!baseline) {
        sessionStorage.setItem(BASELINE_KEY, latest);
        return;
      }
      if (latest !== baseline) {
        setUpdateAvailable(true);
      }
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const reload = () => {
    // Xoá baseline cũ trước khi tải lại — nếu không, bundle mới sau reload vẫn thấy baseline
    // (sessionStorage sống sót qua reload) khác version hiện tại và lại báo "có cập nhật" ngay lập tức.
    sessionStorage.removeItem(BASELINE_KEY);
    window.location.reload();
  };

  return { updateAvailable, reload };
}
