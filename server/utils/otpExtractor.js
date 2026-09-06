/**
 * Extracts OTP / Verification codes and service names from text
 */
function extractOTP(text) {
  if (!text || typeof text !== 'string') return null;

  // Common service names
  const services = [
    'Google', 'WhatsApp', 'Telegram', 'Facebook', 'Instagram', 'TikTok',
    'Discord', 'Twitter', 'X', 'Steam', 'Netflix', 'Amazon', 'Microsoft',
    'Apple', 'Uber', 'Grab', 'Gojek', 'Dana', 'OVO', 'Shopee', 'Tokopedia',
    'Blibli', 'Lazada', 'PayPal', 'Binance', 'Bybit', 'Coinbase', 'Tinder',
    'Bumble', 'Hinge', 'Snapchat', 'Reddit', 'Pinterest', 'OpenAI', 'LinkedIn'
  ];

  let detectedService = null;
  for (const s of services) {
    const regex = new RegExp(`\\b${s}\\b`, 'i');
    if (regex.test(text)) {
      detectedService = s;
      break;
    }
  }

  // Common OTP patterns
  const patterns = [
    // "code is 123456", "kode verifikasi: 123456"
    /(?:code|kode|pin|otp|passcode|token|verification|verifikasi)[\s:=isadalah-]+([0-9]{4,8})\b/i,
    // "123456 is your verification code"
    /\b([0-9]{4,8})\s+(?:is your|adalah kode|is the code)\b/i,
    // G-123456 (Google style)
    /\b([A-Z]-[0-9]{4,8})\b/i,
    // "[123456]" or "(123456)"
    /[\[\(]([0-9]{4,8})[\]\)]/,
    // Standalone 4-8 digit numbers
    /\b([0-9]{4,8})\b/
  ];

  // Detect verification links (e.g. TunnelBear, Twitter, Discord, etc.)
  let verificationLink = null;
  const linkMatches = text.match(/https?:\/\/[^\s"'<>\)]+(?:verify|confirm|activate|validation|token=|key=)[^\s"'<>\)]*/i);
  if (linkMatches && linkMatches[0]) {
    verificationLink = linkMatches[0].replace(/[\.,\);]+$/, '');
  }

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Ignore common years like 2024, 2025, 2026 if it was matched loosely
      const code = match[1];
      if (pattern === patterns[patterns.length - 1]) {
        if (/^(19\d\d|20\d\d)$/.test(code)) continue;
      }
      return {
        code,
        service: detectedService,
        link: verificationLink
      };
    }
  }

  return {
    code: null,
    service: detectedService,
    link: verificationLink
  };
}

module.exports = { extractOTP };
