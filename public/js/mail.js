// Temp Mail Controller
const MailApp = {
  account: null,
  messages: [],
  previousMessageIds: new Set(),
  countdownSeconds: 10,
  countdownInterval: null,
  pollInterval: null,
  isLoading: false,
  domains: [],

  init() {
    this.bindEvents();
    this.loadDomains();

    // Check localStorage for existing account
    const saved = localStorage.getItem('temp_mail_account');
    if (saved) {
      try {
        this.account = JSON.parse(saved);
        this.updateEmailUI();
        this.fetchMessages();
      } catch (e) {
        this.createAccount();
      }
    } else {
      this.createAccount();
    }

    this.startCountdown();
  },

  onTabActive() {
    this.fetchMessages();
  },

  bindEvents() {
    // Copy email button
    document.getElementById('copy-email-btn')?.addEventListener('click', () => {
      if (this.account?.address) {
        App.copyText(this.account.address, 'Alamat email berhasil disalin!');
      }
    });

    // Refresh email button
    document.getElementById('refresh-email-btn')?.addEventListener('click', () => {
      this.fetchMessages(true);
    });

    // Generate random new email
    document.getElementById('change-email-btn')?.addEventListener('click', () => {
      if (confirm('Buat alamat email baru? Kotak masuk email saat ini akan direset.')) {
        this.createAccount();
      }
    });

    // Open custom email modal
    document.getElementById('custom-email-btn')?.addEventListener('click', () => {
      this.openCustomEmailModal();
    });

    // Open QR code modal
    document.getElementById('qr-email-btn')?.addEventListener('click', () => {
      this.openQrModal();
    });

    // Reset / Delete mailbox
    document.getElementById('delete-mailbox-btn')?.addEventListener('click', () => {
      if (confirm('Hapus kotak masuk dan alamat email ini?')) {
        localStorage.removeItem('temp_mail_account');
        this.account = null;
        this.messages = [];
        this.renderMessages();
        this.createAccount();
      }
    });

    // Custom email form submit
    document.getElementById('custom-email-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('custom-username-input');
      const domainSelect = document.getElementById('custom-domain-select');
      const username = usernameInput.value.trim();
      const domain = domainSelect.value;

      if (!username) {
        App.showToast('Masukkan username email yang diinginkan', 'error');
        return;
      }

      this.createAccount(username, domain);
      this.closeModal('custom-email-modal');
    });

    // Close modals on click overlay or close button
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        this.closeModal(modalId);
      });
    });
  },

  async loadDomains() {
    try {
      const res = await fetch('/api/mail/domains');
      const data = await res.json();
      if (data.domains && Array.isArray(data.domains)) {
        this.domains = data.domains;
        const select = document.getElementById('custom-domain-select');
        if (select) {
          select.innerHTML = this.domains.map(d => `<option value="${d}">@${d}</option>`).join('');
        }
      }
    } catch (e) {
      console.warn('Failed to load domains:', e);
    }
  },

  async createAccount(username = '', domain = '') {
    try {
      this.setLoading(true);
      const res = await fetch('/api/mail/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, domain })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membuat akun email');
      }

      this.account = data;
      localStorage.setItem('temp_mail_account', JSON.stringify(data));
      this.previousMessageIds.clear();
      this.messages = [];

      this.updateEmailUI();
      this.renderMessages();
      App.showToast('Alamat email baru siap digunakan!', 'success');
      this.fetchMessages();
    } catch (err) {
      App.showToast(err.message, 'error');
    } finally {
      this.setLoading(false);
    }
  },

  updateEmailUI() {
    const emailDisplay = document.getElementById('current-email-display');
    if (emailDisplay && this.account) {
      emailDisplay.textContent = this.account.address;
    }
  },

  startCountdown() {
    clearInterval(this.countdownInterval);
    clearInterval(this.pollInterval);

    this.countdownSeconds = 10;
    const progressEl = document.getElementById('mail-progress-bar');
    const countdownEl = document.getElementById('mail-countdown-text');

    this.countdownInterval = setInterval(() => {
      this.countdownSeconds--;
      if (countdownEl) countdownEl.textContent = `${this.countdownSeconds}s`;
      if (progressEl) {
        const percent = ((10 - this.countdownSeconds) / 10) * 100;
        progressEl.style.width = `${percent}%`;
      }

      if (this.countdownSeconds <= 0) {
        this.countdownSeconds = 10;
        this.fetchMessages();
      }
    }, 1000);
  },

  async fetchMessages(manual = false) {
    if (!this.account?.token || this.isLoading) return;

    try {
      if (manual) {
        this.setLoading(true);
        const refreshIcon = document.querySelector('#refresh-email-btn i');
        if (refreshIcon) refreshIcon.classList.add('animate-spin');
      }

      const res = await fetch('/api/mail/messages', {
        headers: { 'Authorization': `Bearer ${this.account.token}` }
      });

      if (res.status === 401) {
        // Token expired, re-create
        console.warn('Session expired, regenerating account...');
        this.createAccount();
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        // Detect new incoming emails
        let hasNew = false;
        data.messages.forEach(msg => {
          if (!this.previousMessageIds.has(msg.id)) {
            hasNew = true;
            this.previousMessageIds.add(msg.id);
          }
        });

        if (hasNew && this.messages.length > 0) {
          App.playNotificationSound();
          App.showToast('📬 Email baru diterima!', 'info');
        }

        this.messages = data.messages;
        this.renderMessages();
      }
    } catch (err) {
      console.warn('Fetch messages error:', err);
    } finally {
      if (manual) {
        setTimeout(() => {
          this.setLoading(false);
          const refreshIcon = document.querySelector('#refresh-email-btn i');
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
        }, 500);
      }
    }
  },

  renderMessages() {
    const listContainer = document.getElementById('mail-list-container');
    const emptyState = document.getElementById('mail-empty-state');
    const countBadge = document.getElementById('mail-count-badge');

    if (countBadge) {
      countBadge.textContent = this.messages.length;
    }

    if (!listContainer) return;

    if (this.messages.length === 0) {
      listContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    listContainer.innerHTML = this.messages.map(msg => {
      const senderName = msg.from?.name || msg.from?.address || 'Pengirim Tidak Dikenal';
      const senderAddr = msg.from?.address || '';
      const dateStr = this.formatDate(msg.createdAt);

      let otpBadge = '';
      if (msg.otp && msg.otp.code) {
        otpBadge = `
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold" onclick="event.stopPropagation(); App.copyText('${msg.otp.code}', 'Kode OTP disalin!')">
            <i data-lucide="key" class="w-3.5 h-3.5"></i>
            <span>OTP: <span class="font-mono tracking-wider font-bold text-amber-200">${msg.otp.code}</span></span>
            <span class="text-[10px] bg-amber-500/20 px-1 py-0.5 rounded cursor-pointer hover:bg-amber-500/40">Salin</span>
          </div>
        `;
      }

      return `
        <div class="glass-card p-4 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group" onclick="MailApp.openMessageDetail('${msg.id}')">
          <div class="flex items-start gap-3.5 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 group-hover:scale-105 transition-transform">
              <i data-lucide="${msg.seen ? 'mail-open' : 'mail'}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-slate-100 text-sm truncate">${this.escapeHtml(senderName)}</span>
                <span class="text-xs text-slate-400 truncate">&lt;${this.escapeHtml(senderAddr)}&gt;</span>
              </div>
              <h4 class="text-sm font-medium text-slate-200 group-hover:text-indigo-300 transition-colors truncate mt-0.5">${this.escapeHtml(msg.subject)}</h4>
              <p class="text-xs text-slate-400 truncate mt-1 max-w-xl">${this.escapeHtml(msg.intro || 'Tidak ada preview teks')}</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5 sm:self-center flex-shrink-0">
            ${otpBadge}
            <span class="text-xs text-slate-500 whitespace-nowrap">${dateStr}</span>
            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors"></i>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  async openMessageDetail(id) {
    if (!this.account?.token) return;

    const modal = document.getElementById('message-detail-modal');
    const modalContent = document.getElementById('message-detail-content');
    if (!modal || !modalContent) return;

    modal.classList.remove('hidden');
    modalContent.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 gap-3">
        <i data-lucide="loader-2" class="w-8 h-8 text-indigo-400 animate-spin"></i>
        <p class="text-sm text-slate-400">Memuat detail email...</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    try {
      const res = await fetch(`/api/mail/messages/${id}`, {
        headers: { 'Authorization': `Bearer ${this.account.token}` }
      });

      if (!res.ok) throw new Error('Gagal memuat detail email');
      const data = await res.json();

      let otpSection = '';
      if (data.otp && data.otp.code) {
        otpSection = `
          <div class="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <i data-lucide="shield-check" class="w-5 h-5"></i>
              </div>
              <div>
                <p class="text-xs font-semibold text-amber-400 uppercase tracking-wider">Kode Verifikasi (OTP) Terdeteksi</p>
                <div class="text-2xl font-mono font-extrabold text-amber-200 tracking-wider mt-0.5">${data.otp.code}</div>
              </div>
            </div>
            <button onclick="App.copyText('${data.otp.code}', 'Kode OTP berhasil disalin!')" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-lg flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all">
              <i data-lucide="copy" class="w-4 h-4"></i>
              <span>Salin OTP</span>
            </button>
          </div>
        `;
      }

      let attachmentsHtml = '';
      if (data.attachments && data.attachments.length > 0) {
        attachmentsHtml = `
          <div class="mt-6 pt-4 border-t border-slate-800">
            <h5 class="text-xs font-semibold text-slate-400 uppercase mb-3">Lampiran (${data.attachments.length})</h5>
            <div class="flex flex-wrap gap-2">
              ${data.attachments.map(att => `
                <a href="https://api.mail.tm${att.downloadUrl}" target="_blank" class="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs border border-slate-700 transition-colors">
                  <i data-lucide="paperclip" class="w-3.5 h-3.5 text-indigo-400"></i>
                  <span class="truncate max-w-xs">${att.filename}</span>
                  <span class="text-slate-400">(${this.formatBytes(att.size)})</span>
                </a>
              `).join('')}
            </div>
          </div>
        `;
      }

      modalContent.innerHTML = `
        <div class="flex flex-col gap-4">
          <!-- Header -->
          <div class="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 class="text-lg font-bold text-slate-100">${this.escapeHtml(data.subject)}</h3>
              <div class="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <span class="font-medium text-slate-200">${this.escapeHtml(data.from?.name || data.from?.address)}</span>
                <span>&lt;${this.escapeHtml(data.from?.address)}&gt;</span>
                <span>•</span>
                <span>${this.formatDate(data.createdAt)}</span>
              </div>
            </div>
            <button onclick="MailApp.deleteMessage('${data.id}')" class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Hapus Email">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- OTP Box -->
          ${otpSection}

          <!-- View Toggle -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-medium">
              <button id="view-html-tab" onclick="MailApp.toggleContentView('html')" class="px-3 py-1 rounded bg-indigo-600 text-white shadow-sm">Tampilan HTML</button>
              <button id="view-text-tab" onclick="MailApp.toggleContentView('text')" class="px-3 py-1 rounded text-slate-400 hover:text-white">Teks Polos</button>
            </div>
          </div>

          <!-- Content View Container -->
          <div id="email-html-view" class="email-iframe-container rounded-xl overflow-hidden border border-slate-800 bg-white">
            <iframe id="email-body-iframe" sandbox="allow-same-origin allow-popups"></iframe>
          </div>
          <div id="email-text-view" class="hidden p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            ${this.escapeHtml(data.text || 'Tidak ada konten teks')}
          </div>

          <!-- Attachments -->
          ${attachmentsHtml}
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      // Render HTML into iframe safely
      const iframe = document.getElementById('email-body-iframe');
      if (iframe) {
        const htmlDoc = iframe.contentDocument || iframe.contentWindow.document;
        htmlDoc.open();
        htmlDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; margin: 0; color: #1e293b; line-height: 1.6; word-break: break-word; }
                a { color: #4f46e5; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>${data.html || `<pre style="white-space: pre-wrap;">${this.escapeHtml(data.text)}</pre>`}</body>
          </html>
        `);
        htmlDoc.close();
      }
    } catch (err) {
      modalContent.innerHTML = `
        <div class="text-center py-12 text-rose-400">
          <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-2"></i>
          <p class="text-sm font-medium">${err.message}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  },

  toggleContentView(view) {
    const htmlView = document.getElementById('email-html-view');
    const textView = document.getElementById('email-text-view');
    const htmlTab = document.getElementById('view-html-tab');
    const textTab = document.getElementById('view-text-tab');

    if (view === 'html') {
      htmlView?.classList.remove('hidden');
      textView?.classList.add('hidden');
      htmlTab?.classList.add('bg-indigo-600', 'text-white');
      htmlTab?.classList.remove('text-slate-400');
      textTab?.classList.remove('bg-indigo-600', 'text-white');
      textTab?.classList.add('text-slate-400');
    } else {
      htmlView?.classList.add('hidden');
      textView?.classList.remove('hidden');
      textTab?.classList.add('bg-indigo-600', 'text-white');
      textTab?.classList.remove('text-slate-400');
      htmlTab?.classList.remove('bg-indigo-600', 'text-white');
      htmlTab?.classList.add('text-slate-400');
    }
  },

  async deleteMessage(id) {
    if (!confirm('Hapus email ini?')) return;
    try {
      const res = await fetch(`/api/mail/messages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.account.token}` }
      });
      if (res.ok) {
        App.showToast('Email berhasil dihapus', 'success');
        this.closeModal('message-detail-modal');
        this.messages = this.messages.filter(m => m.id !== id);
        this.renderMessages();
      }
    } catch (e) {
      App.showToast('Gagal menghapus email', 'error');
    }
  },

  openCustomEmailModal() {
    const modal = document.getElementById('custom-email-modal');
    if (modal) modal.classList.remove('hidden');
  },

  openQrModal() {
    if (!this.account?.address) return;
    const modal = document.getElementById('qr-modal');
    const container = document.getElementById('qr-code-container');
    const addrEl = document.getElementById('qr-email-text');

    if (addrEl) addrEl.textContent = this.account.address;
    if (container) {
      container.innerHTML = '';
      if (window.QRCode) {
        new QRCode(container, {
          text: this.account.address,
          width: 180,
          height: 180,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }

    if (modal) modal.classList.remove('hidden');
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  },

  setLoading(val) {
    this.isLoading = val;
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  },

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  MailApp.init();
});
