const express = require('express');
const router = express.Router();
const { extractOTP } = require('../utils/otpExtractor');

const MAILTM_API = 'https://api.mail.tm';

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

// 1. Get available domains
router.get('/domains', async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${MAILTM_API}/domains`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Gagal mengambil domain dari Mail.tm' });
    }
    const data = await response.json();
    const domains = (data['hydra:member'] || []).filter(d => d.isActive).map(d => d.domain);
    return res.json({ domains: domains.length ? domains : ['uberip.com'] });
  } catch (error) {
    console.error('Error fetching domains:', error.message);
    // Fallback known domains
    return res.json({ domains: ['uberip.com'] });
  }
});

// 2. Create account & get JWT token
router.post('/account', async (req, res) => {
  try {
    let { username, domain, password } = req.body;

    // Get default domain if not provided
    if (!domain) {
      try {
        const dRes = await fetchWithTimeout(`${MAILTM_API}/domains`);
        const dData = await dRes.json();
        domain = dData['hydra:member']?.[0]?.domain || 'uberip.com';
      } catch {
        domain = 'uberip.com';
      }
    }

    // Generate random username if not provided
    if (!username) {
      const adjectives = ['swift', 'hyper', 'shadow', 'cyber', 'nexus', 'alpha', 'pixel', 'vortex', 'spark', 'flux'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randStr = Math.random().toString(36).substring(2, 7);
      username = `${adj}_${randStr}`;
    } else {
      // sanitize username
      username = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    }

    const email = `${username}@${domain}`;
    const accPassword = password || `TempPass_${Math.random().toString(36).substring(2, 10)}!`;

    // Create Account on Mail.tm
    const createRes = await fetchWithTimeout(`${MAILTM_API}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: email, password: accPassword })
    });

    if (!createRes.ok) {
      const errJson = await createRes.json().catch(() => ({}));
      return res.status(createRes.status).json({
        error: errJson.message || 'Alamat email ini sudah digunakan atau tidak valid. Silakan coba username lain.'
      });
    }

    const accountData = await createRes.json();

    // Get JWT Token
    const tokenRes = await fetchWithTimeout(`${MAILTM_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: email, password: accPassword })
    });

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: 'Gagal mendapatkan token otentikasi' });
    }

    const tokenData = await tokenRes.json();

    return res.json({
      success: true,
      address: email,
      token: tokenData.token,
      accountId: accountData.id,
      domain
    });
  } catch (error) {
    console.error('Error creating account:', error);
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

    const response = await fetchWithTimeout(`${MAILTM_API}/messages?page=1`, {
      headers: { 'Authorization': authHeader }
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

    const messageId = req.params.id;
    const response = await fetchWithTimeout(`${MAILTM_API}/messages/${messageId}`, {
      headers: { 'Authorization': authHeader }
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

    const messageId = req.params.id;
    const response = await fetchWithTimeout(`${MAILTM_API}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': authHeader }
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
