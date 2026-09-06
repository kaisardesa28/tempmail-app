const express = require('express');
const router = express.Router();
const { extractOTP } = require('../utils/otpExtractor');

const MAILTM_API = 'https://api.mail.tm';

// Helper to get client IP or generate rotated IP to avoid Vercel shared IP rate-limiting (429)
function getRotatedIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('10.') && !ip.startsWith('192.168.')) {
      return ip;
    }
  }
  const part1 = 100 + Math.floor(Math.random() * 120);
  const part2 = Math.floor(Math.random() * 250);
  const part3 = Math.floor(Math.random() * 250);
  return `103.${part1}.${part2}.${part3}`;
}

// Helper for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// 1. Get available domains (Locked to uberip.com)
router.get('/domains', async (req, res) => {
  try {
    const ip = getRotatedIp(req);
    const response = await fetchWithTimeout(`${MAILTM_API}/domains`, {
      headers: { 'X-Forwarded-For': ip, 'Client-IP': ip }
    });
    if (response.ok) {
      const data = await response.json();
      const domains = (data['hydra:member'] || []).filter(d => d.isActive).map(d => d.domain);
      if (domains.length > 0) {
        return res.json({ domains });
      }
    }
    return res.json({ domains: ['uberip.com'] });
  } catch (error) {
    return res.json({ domains: ['uberip.com'] });
  }
});

// 2. Create account & get JWT token on uberip.com
router.post('/account', async (req, res) => {
  try {
    let { username, domain, password } = req.body;
    const targetDomain = 'uberip.com';

    // Generate random username if not provided
    if (!username) {
      const prefixes = ['swift', 'hyper', 'shadow', 'cyber', 'nexus', 'alpha', 'pixel', 'vortex', 'spark', 'flux'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randStr = Math.random().toString(36).substring(2, 7);
      username = `${prefix}_${randStr}`;
    } else {
      username = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    }

    const email = `${username}@${targetDomain}`;
    const accPassword = password || `TempPass_${Math.random().toString(36).substring(2, 10)}!`;

    // Attempt creation with IP rotation (up to 3 tries if rate limited)
    let createRes = null;
    let createData = null;
    let attemptIp = getRotatedIp(req);

    for (let attempt = 0; attempt < 3; attempt++) {
      createRes = await fetchWithTimeout(`${MAILTM_API}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': attemptIp,
          'Client-IP': attemptIp
        },
        body: JSON.stringify({ address: email, password: accPassword })
      });

      if (createRes.ok) {
        createData = await createRes.json();
        break;
      }

      if (createRes.status === 429) {
        // Rotate IP and retry immediately
        const p1 = 100 + Math.floor(Math.random() * 120);
        const p2 = Math.floor(Math.random() * 250);
        const p3 = Math.floor(Math.random() * 250);
        attemptIp = `182.${p1}.${p2}.${p3}`;
        continue;
      }

      // If status 422 (already exists), append random suffix
      if (createRes.status === 422) {
        const extraRand = Math.random().toString(36).substring(2, 6);
        const newEmail = `${username}_${extraRand}@${targetDomain}`;
        createRes = await fetchWithTimeout(`${MAILTM_API}/accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': attemptIp,
            'Client-IP': attemptIp
          },
          body: JSON.stringify({ address: newEmail, password: accPassword })
        });
        if (createRes.ok) {
          createData = await createRes.json();
          break;
        }
      }
    }

    if (!createData) {
      const errText = createRes ? await createRes.text().catch(() => '') : 'no response';
      return res.status(createRes ? createRes.status : 500).json({
        error: `Mail.tm error [${createRes ? createRes.status : 0}]: ${errText || 'Gagal membuat akun email di domain @uberip.com.'}`
      });
    }

    // Get JWT Token from Mail.tm
    const tokenRes = await fetchWithTimeout(`${MAILTM_API}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': attemptIp,
        'Client-IP': attemptIp
      },
      body: JSON.stringify({ address: createData.address, password: accPassword })
    });

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: 'Gagal mendapatkan token otentikasi' });
    }

    const tokenData = await tokenRes.json();

    return res.json({
      success: true,
      address: createData.address,
      token: tokenData.token,
      accountId: createData.id,
      domain: targetDomain
    });
  } catch (error) {
    console.error('Error creating Mail.tm account:', error);
    return res.status(500).json({ error: 'Server error saat membuat akun email: ' + error.message });
  }
});

// 3. Get messages for current account
router.get('/messages', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Header Authorization diperlukan' });
    }

    const ip = getRotatedIp(req);
    const response = await fetchWithTimeout(`${MAILTM_API}/messages?page=1`, {
      headers: {
        'Authorization': authHeader,
        'X-Forwarded-For': ip,
        'Client-IP': ip
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Gagal memuat pesan email' });
    }

    const data = await response.json();
    const rawMessages = data['hydra:member'] || [];

    const messages = rawMessages.map(msg => {
      const combinedText = `${msg.subject || ''} ${msg.intro || ''}`;
      const otpInfo = extractOTP(combinedText);

      return {
        id: msg.id,
        from: msg.from,
        to: msg.to,
        subject: msg.subject || '(Tanpa Subjek)',
        intro: msg.intro || '',
        seen: msg.seen,
        isDeleted: msg.isDeleted,
        hasAttachments: msg.hasAttachments,
        size: msg.size,
        createdAt: msg.createdAt,
        otp: otpInfo
      };
    });

    return res.json({
      success: true,
      total: data['hydra:totalItems'] || messages.length,
      messages
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    return res.status(500).json({ error: 'Gagal mengambil daftar email: ' + error.message });
  }
});

// 4. Get specific message detail
router.get('/messages/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Header Authorization diperlukan' });
    }

    const ip = getRotatedIp(req);
    const messageId = req.params.id;
    const response = await fetchWithTimeout(`${MAILTM_API}/messages/${messageId}`, {
      headers: {
        'Authorization': authHeader,
        'X-Forwarded-For': ip,
        'Client-IP': ip
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Email tidak ditemukan atau sudah kadaluarsa' });
    }

    const msg = await response.json();
    const fullBody = (msg.text || '') + ' ' + (msg.subject || '');
    const otpInfo = extractOTP(fullBody);

    return res.json({
      success: true,
      id: msg.id,
      from: msg.from,
      to: msg.to,
      subject: msg.subject || '(Tanpa Subjek)',
      text: msg.text || '',
      html: Array.isArray(msg.html) ? msg.html.join('') : (msg.html || ''),
      attachments: msg.attachments || [],
      createdAt: msg.createdAt,
      otp: otpInfo
    });
  } catch (error) {
    console.error('Error fetching message detail:', error);
    return res.status(500).json({ error: 'Gagal memuat detail email: ' + error.message });
  }
});

// 5. Delete specific message
router.delete('/messages/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Header Authorization diperlukan' });
    }

    const ip = getRotatedIp(req);
    const messageId = req.params.id;
    const response = await fetchWithTimeout(`${MAILTM_API}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'X-Forwarded-For': ip,
        'Client-IP': ip
      }
    });

    if (!response.ok && response.status !== 204) {
      return res.status(response.status).json({ error: 'Gagal menghapus email' });
    }

    return res.json({ success: true, message: 'Email berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Gagal menghapus email: ' + error.message });
  }
});

module.exports = router;
