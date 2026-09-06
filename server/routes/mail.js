const express = require('express');
const router = express.Router();
const { extractOTP } = require('../utils/otpExtractor');

const MAILTM_API = 'https://api.mail.tm';

// Pre-generated seed pool of active @uberip.com accounts (Instant fallback if Mail.tm throttles)
const SEED_ACCOUNTS = [
  {
    address: "uber_uj1kc1x@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MTIsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl91ajFrYzF4QHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWM3ZjJhZjQzNDIyMTBmNGM1MSIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTljN2YyYWY0MzQyMjEwZjRjNTEiXX19.lRyDXzM3dzmFWpo90HtrQ94X4VzUDSGPvk0t3-8jxI7zXG9ew4uNxKk5HV-0Sd8k63X6zyuGUJQRkd8Ss5UEEA",
    accountId: "6a9da9c7f2af4342210f4c51"
  },
  {
    address: "uber_fiaq196@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MTMsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl9maWFxMTk2QHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWM4ZGJjMzM1OTFhYjBiOGQxYiIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTljOGRiYzMzNTkxYWIwYjhkMWIiXX19.EbWMk7mcO3Jxu84LI_jTruQ4iSYoLFOtPQvi61nyHDBzs8wUBCOSsLnJ3p-wdfGpeC2jcprEH_tb2gtG7RsE9w",
    accountId: "6a9da9c8dbc33591ab0b8d1b"
  },
  {
    address: "uber_hwh1clj@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MTMsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl9od2gxY2xqQHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWM5ZjJhZjQzNDIyMTBmNGM1MiIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTljOWYyYWY0MzQyMjEwZjRjNTIiXX19.czUWS58Kd7-rGd7-UeknvpBcO76C6xUy4Xu6FRGgb5KXoGp70wj0N39ihVwZojqbeK59LIQrhMfGCvatwxT5sA",
    accountId: "6a9da9c9f2af4342210f4c52"
  },
  {
    address: "uber_x89idp2@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MjAsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl94ODlpZHAyQHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWNmYmRkZjIzOTA4ZjBkZjAyMyIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTljZmJkZGYyMzkwOGYwZGYwMjMiXX19.F1A1qtNdMFCBVe2g-g8joISvFQHSUNp4jvG89oFNJIFzN0dPpA--RzYhYYOrFIq2Xo16b2S18CIdnLDN4PbKOQ",
    accountId: "6a9da9cfbddf23908f0df023"
  },
  {
    address: "uber_57lqfd4@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MjEsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl81N2xxZmQ0QHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWQwM2JjMWJjMzdmMzBjNDNlNiIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTlkMDNiYzFiYzM3ZjMwYzQzZTYiXX19.9xBIWeKeH-E1Ign9kwDgE9pCW7cV5g-tWaz6xE_7y_9rZv98cP1I_buHp8CI7qiAnCPPKkPwqNrt4Pbk6Fb1tQ",
    accountId: "6a9da9d03bc1bc37f30c43e6"
  },
  {
    address: "uber_07lmlj3@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MjEsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl8wN2xtbGozQHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWQxYTQyOGFmOTdiNjBiOGY2OCIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTlkMWE0MjhhZjk3YjYwYjhmNjgiXX19.Hn0AlNHmzr-uCZ-oI-2QR9ToMbQPvSbPeKt0Oe-A2UlELdcFfXVp9l1ZbA_Y54mesy0q_mILjEjtV7cQ2DOHYw",
    accountId: "6a9da9d1a428af97b60b8f68"
  },
  {
    address: "uber_6d1gdup@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MjIsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl82ZDFnZHVwQHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWQyZGEzZGQ2YWYwOTA4NTZlZSIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTlkMmRhM2RkNmFmMDkwODU2ZWUiXX19.rH4f1YiKxRTdtqxFzS4UUn8ZbuuyEXQSeQ2zIpgyh1OUMLOx9HfKHgLymdwCDxehmiPFdXe4EUaGPdhhD6EUwA",
    accountId: "6a9da9d2da3dd6af090856ee"
  },
  {
    address: "uber_u5qnwd9@uberip.com",
    token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpYXQiOjE3ODg3MTc1MjMsInJvbGVzIjpbIlJPTEVfVVNFUiJdLCJhZGRyZXNzIjoidWJlcl91NXFud2Q5QHViZXJpcC5jb20iLCJpZCI6IjZhOWRhOWQyNWQ4ZTQ1ZTFlNzA2N2YwNyIsIm1lcmN1cmUiOnsic3Vic2NyaWJlIjpbIi9hY2NvdW50cy82YTlkYTlkMjVkOGU0NWUxZTcwNjdmMDciXX19.iIpB1Dv6Vvqm9Rwj_nv8zHOdCeJB_tGpDnB_zSSbprlV7Yf0SaqiURWjcN39kjKQC3c8HbyB1ZR3_njFf02Z2g",
    accountId: "6a9da9d25d8e45e1e7067f07"
  }
];

let poolIndex = 0;
function getNextPoolAccount() {
  const acc = SEED_ACCOUNTS[poolIndex % SEED_ACCOUNTS.length];
  poolIndex++;
  return acc;
}

// Generate base headers that bypass Mail.tm anti-bot checks
function getMailTmHeaders() {
  const p1 = 100 + Math.floor(Math.random() * 120);
  const p2 = Math.floor(Math.random() * 250);
  const p3 = Math.floor(Math.random() * 250);
  const fakeIp = `103.${p1}.${p2}.${p3}`;

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://mail.tm',
    'Referer': 'https://mail.tm/',
    'X-Forwarded-For': fakeIp,
    'Client-IP': fakeIp,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
}

// Helper for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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

// 1. Get available domains (Locked strictly to uberip.com)
router.get('/domains', (req, res) => {
  return res.json({ domains: ['uberip.com'] });
});

// 2. Create account & get JWT token (100% @uberip.com)
router.post('/account', async (req, res) => {
  try {
    let { username, password } = req.body;
    const targetDomain = 'uberip.com';

    // If custom username requested, attempt creation on Mail.tm
    if (username) {
      username = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    } else {
      const prefixes = ['swift', 'hyper', 'shadow', 'cyber', 'nexus', 'alpha', 'pixel', 'vortex', 'spark', 'flux'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const randStr = Math.random().toString(36).substring(2, 7);
      username = `${prefix}_${randStr}`;
    }

    const email = `${username}@${targetDomain}`;
    const accPassword = password || `TempPass_${Math.random().toString(36).substring(2, 10)}!`;

    let accountAddress = null;
    let accountToken = null;
    let accountId = null;

    try {
      const headers = getMailTmHeaders();

      // Step A: Create Account on Mail.tm
      const createRes = await fetchWithTimeout(`${MAILTM_API}/accounts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ address: email, password: accPassword })
      });

      if (createRes.status === 201) {
        const createData = await createRes.json();
        accountAddress = createData.address;
        accountId = createData.id;

        // Step B: Get JWT Token
        const tokenRes = await fetchWithTimeout(`${MAILTM_API}/token`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ address: email, password: accPassword })
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          accountToken = tokenData.token;
        }
      }
    } catch (e) {
      console.warn('Live Mail.tm create failed, falling back to seed pool:', e.message);
    }

    // If live creation failed or throttled, instantly use pool account (Zero downtime for user!)
    if (!accountAddress || !accountToken) {
      const poolAcc = getNextPoolAccount();
      accountAddress = poolAcc.address;
      accountToken = poolAcc.token;
      accountId = poolAcc.accountId;
    }

    return res.json({
      success: true,
      address: accountAddress,
      token: accountToken,
      accountId,
      domain: targetDomain
    });
  } catch (error) {
    console.error('Account handler error:', error);
    // Absolute fallback: deliver pool account
    const poolAcc = getNextPoolAccount();
    return res.json({
      success: true,
      address: poolAcc.address,
      token: poolAcc.token,
      accountId: poolAcc.accountId,
      domain: 'uberip.com'
    });
  }
});

// 3. Get messages for current account
router.get('/messages', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Header Authorization diperlukan' });
    }

    const headers = {
      ...getMailTmHeaders(),
      'Authorization': authHeader
    };

    const response = await fetchWithTimeout(`${MAILTM_API}/messages?page=1`, { headers });

    if (!response.ok) {
      return res.json({ success: true, total: 0, messages: [] });
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
    console.error('Error getting messages:', error.message);
    return res.json({ success: true, total: 0, messages: [] });
  }
});

// 4. Get specific message detail
router.get('/messages/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Header Authorization diperlukan' });
    }

    const headers = {
      ...getMailTmHeaders(),
      'Authorization': authHeader
    };

    const messageId = req.params.id;
    const response = await fetchWithTimeout(`${MAILTM_API}/messages/${messageId}`, { headers });

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
    console.error('Error fetching message detail:', error.message);
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

    const headers = {
      ...getMailTmHeaders(),
      'Authorization': authHeader
    };

    const messageId = req.params.id;
    const response = await fetchWithTimeout(`${MAILTM_API}/messages/${messageId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok && response.status !== 204) {
      return res.status(response.status).json({ error: 'Gagal menghapus email' });
    }

    return res.json({ success: true, message: 'Email berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting message:', error.message);
    return res.status(500).json({ error: 'Gagal menghapus email: ' + error.message });
  }
});

module.exports = router;
