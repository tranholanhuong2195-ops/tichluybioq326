import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const json = (statusCode, obj) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(obj)
});

const safeEq = (a, b) => {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

const tokenFor = (group, secret) =>
  crypto.createHmac('sha256', secret)
    .update(group)
    .digest('hex')
    .slice(0, 32);

export const handler = async (event) => {
  try {
    const store = getStore('bio-q3-2026');

    const adminSecret = process.env.BIO_ADMIN_KEY;
    const linkSecret = process.env.BIO_LINK_SECRET;

    if (!adminSecret || !linkSecret) {
      return json(500, {
        error: 'Chưa cấu hình BIO_ADMIN_KEY / BIO_LINK_SECRET trên Netlify.'
      });
    }

    /* =========================
       QLBH - ĐỌC DỮ LIỆU
       ========================= */
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const group = params.group || '';
      const token = params.token || '';

      if (!group || !safeEq(token, tokenFor(group, linkSecret))) {
        return json(403, {
          error: 'Link QLBH không hợp lệ.'
        });
      }

      const pack = await store.get('current', { type: 'json' });

      if (!pack) {
        return json(404, {
          error: 'Admin chưa lưu dữ liệu chung.'
        });
      }

      return json(200, {
        updatedAt: pack.updatedAt,
        data: (pack.data || []).filter(r => r.mien === group)
      });
    }

    /* =========================
       ADMIN
       ========================= */
    if (event.httpMethod !== 'POST') {
      return json(405, {
        error: 'Method not allowed'
      });
    }

    let body = {};

    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      body = {};
    }

    if (!safeEq(body.adminKey, adminSecret)) {
      return json(403, {
        error: 'Mật khẩu Admin không đúng.'
      });
    }

    /* Đọc dữ liệu chung */
    if (body.action === 'read-admin') {
      const pack = await store.get('current', { type: 'json' });

      return json(
        200,
        pack || {
          data: null,
          updatedAt: null
        }
      );
    }

    /* Admin lưu dữ liệu mới */
    if (body.action === 'upload') {
      if (!Array.isArray(body.data)) {
        return json(400, {
          error: 'Dữ liệu không hợp lệ.'
        });
      }

      const cleaned = body.data.map(
        ({ mien, tdv, ma, ten, sales, acimin, meracine }) => ({
          mien,
          tdv,
          ma,
          ten,
          sales: +sales || 0,
          acimin: +acimin || 0,
          meracine: +meracine || 0
        })
      );

      const updatedAt = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date());

      await store.setJSON('current', {
        updatedAt,
        data: cleaned
      });

      return json(200, {
        ok: true,
        updatedAt,
        count: cleaned.length
      });
    }

    /* Tạo link QLBH */
    if (body.action === 'links') {
      const pack = await store.get('current', { type: 'json' });

      const groups = [
        ...new Set(
          (pack?.data || [])
            .map(x => x.mien)
            .filter(Boolean)
        )
      ].sort();

      const base = String(body.baseUrl || '')
        .replace(/\?.*$/, '');

      return json(200, {
        links: groups.map(group => ({
          group,
          url:
            `${base}?group=${encodeURIComponent(group)}` +
            `&token=${tokenFor(group, linkSecret)}`
        }))
      });
    }

    return json(400, {
      error: 'Action không hợp lệ.'
    });

  } catch (err) {
    console.error('BIO FUNCTION ERROR:', err);

    return json(500, {
      error: 'Lỗi máy chủ.',
      detail: err?.message || String(err)
    });
  }
};
