const express = require('express');
const router = express.Router();
const { extractOTP } = require('../utils/otpExtractor');

const GUERRILLA_API = 'https://api.guerrillamail.com/ajax.php';

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

// Available Guerrilla Mail domains (Clean & popular domains)
const AVAILABLE_DOMAINS = [
  'sharklasers.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'grr.la',
  'guerrillamail.net',
  'guerrillamail.org',
  'pokemail.net'
];

// 1. Get available domains
router.get('/domains', (req, res) => {
  res.json({ domains: AVAILABLE_DOMAINS });
});

// 2. Create account & get session token
router.post('/account', async (req, res) => {
  try {
    let { username, domain } = req.body;

    // Get initial address & session token
    const initRes = await fetchWithTimeout(`${GUERRILLA_API}?f=get_email_address&lang=en`);
    if (!initRes.ok) {
      throw new Error(`API returned ${initRes.status}`);
    }
    const initData = await initRes.json();
    let sid = initData.sid_token;
    let email = initData.email_addr;

    // Default to sharklasers.com or chosen domain
    const targetDomain = (domain && AVAILABLE_DOMAINS.includes(domain)) ? domain : 'sharklasers.com';

    // If custom username requested, set it
    if (username) {
      const cleanUser = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const setUserRes = await fetchWithTimeout(`${GUERRILLA_API}?f=set_email_user&email_user=${encodeURIComponent(cleanUser)}&lang=en&sid_token=${sid}`);
      if (setUserRes.ok) {
        const setUserData = await setUserRes.json();
        email = setUserData.email_addr;
        sid = setUserData.sid_token || sid;
      }
    } else {
      // Set to sharklasers.com
      const userPart = email.split('@')[0];
      email = `${userPart}@${targetDomain}`;
    }

    return res.json({
      success: true,
      address: email,
      token: sid,
      accountId: sid,
      domain: targetDomain
    });
  } catch (error) {
    console.error('Error creating account on Guerrilla Mail:', error.message);
    return res.status(500).json({ error: 'Gagal membuat akun email sementara: ' + error.message });
  }
});

// 3. Get messages for current session
router.get('/messages', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Header Authorization diperlukan' });
    }

    const sid = authHeader.replace(/^Bearer\s+/i, '').trim();
    const response = await fetchWithTimeout(`${GUERRILLA_API}?f=check_email&seq=0&sid_token=${encodeURIComponent(sid)}`);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Gagal memuat pesan email' });
    }

    const data = await response.json();
    const rawList = data.list || [];

    const messages = rawList.map(item => {
      const combinedText = `${item.mail_subject || ''} ${item.mail_excerpt || ''}`;
      const otpInfo = extractOTP(combinedText);

      let createdAt = new Date().toISOString();
      if (item.mail_timestamp) {
        createdAt = new Date(parseInt(item.mail_timestamp) * 1000).toISOString();
      } else if (item.mail_date) {
        createdAt = item.mail_date;
      }

      return {
        id: item.mail_id,
        from: {
          name: item.mail_from || 'Pengirim',
          address: item.mail_from || ''
        },
        to: data.email_addr || '',
        subject: item.mail_subject || '(Tanpa Subjek)',
        intro: item.mail_excerpt || '',
        seen: item.mail_read === 1 || item.mail_read === '1',
        isDeleted: false,
        hasAttachments: false,
        size: parseInt(item.mail_size) || 0,
        createdAt,
        otp: otpInfo
      };
    });

    return res.json({
      success: true,
      total: messages.length,
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

    const sid = authHeader.replace(/^Bearer\s+/i, '').trim();
    const mailId = req.params.id;

    const response = await fetchWithTimeout(`${GUERRILLA_API}?f=fetch_email&email_id=${encodeURIComponent(mailId)}&sid_token=${encodeURIComponent(sid)}`);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Email tidak ditemukan' });
    }

    const data = await response.json();
    const fullBody = (data.mail_body || '') + ' ' + (data.mail_subject || '');
    const otpInfo = extractOTP(fullBody);

    let createdAt = new Date().toISOString();
    if (data.mail_timestamp) {
      createdAt = new Date(parseInt(data.mail_timestamp) * 1000).toISOString();
    } else if (data.mail_date) {
      createdAt = data.mail_date;
    }

    return res.json({
      success: true,
      id: data.mail_id,
      from: {
        name: data.mail_from || 'Pengirim',
        address: data.mail_from || ''
      },
      to: data.mail_recipient || '',
      subject: data.mail_subject || '(Tanpa Subjek)',
      text: data.mail_body || '',
      html: data.mail_body || '',
      attachments: [],
      createdAt,
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

    const sid = authHeader.replace(/^Bearer\s+/i, '').trim();
    const mailId = req.params.id;

    const response = await fetchWithTimeout(`${GUERRILLA_API}?f=del_email&email_ids[]=${encodeURIComponent(mailId)}&sid_token=${encodeURIComponent(sid)}`);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Gagal menghapus email' });
    }

    return res.json({ success: true, message: 'Email berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Gagal menghapus email: ' + error.message });
  }
});

module.exports = router;
