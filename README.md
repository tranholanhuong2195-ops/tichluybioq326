# Dashboard Tích lũy BIO QIII/2026 — V8

Triển khai bằng Netlify Continuous Deployment từ GitHub.

## Netlify environment variables
- `BIO_ADMIN_KEY`
- `BIO_LINK_SECRET`

Không lưu giá trị secret vào repository.

## Chức năng
- Admin: `/?admin=1` → đọc/lưu dữ liệu chung.
- QLBH: link có `group` + token ký HMAC, backend chỉ trả dữ liệu của nhóm tương ứng.
- Dữ liệu chung lưu bằng Netlify Blobs.
