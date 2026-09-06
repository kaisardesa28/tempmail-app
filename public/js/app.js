// Main Application Controller & Utilities
const App = {
  soundEnabled: true,
  audioCtx: null,

  init() {
    // Load sound preference
    const savedSound = localStorage.getItem('sound_enabled');
    if (savedSound !== null) {
      this.soundEnabled = savedSound === 'true';
    }
    this.updateSoundIcon();

    // Setup sound toggle listener
    document.getElementById('sound-toggle-btn')?.addEventListener('click', () => this.toggleSound());

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('sound_enabled', this.soundEnabled);
    this.updateSoundIcon();
    this.showToast(this.soundEnabled ? 'Suara notifikasi diaktifkan' : 'Suara notifikasi dibisukan', 'info');
    if (this.soundEnabled) {
      this.playNotificationSound();
    }
  },

  updateSoundIcon() {
    const btn = document.getElementById('sound-toggle-btn');
    if (!btn) return;
    if (this.soundEnabled) {
      btn.innerHTML = `<i data-lucide="volume-2" class="w-5 h-5 text-indigo-400"></i><span class="hidden sm:inline text-xs text-slate-300 font-medium">Suara Aktif</span>`;
    } else {
      btn.innerHTML = `<i data-lucide="volume-x" class="w-5 h-5 text-slate-500"></i><span class="hidden sm:inline text-xs text-slate-500 font-medium">Bisukan</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
  },

  // Synthesize clean audio notification chime using Web Audio API (Zero external file dependencies)
  playNotificationSound() {
    if (!this.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      // Pleasant chime: C6 (880Hz) to E6 (1320Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  },

  // Toast notification
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-500/90 border-emerald-400/50 text-white',
      info: 'bg-indigo-500/90 border-indigo-400/50 text-white',
      error: 'bg-rose-500/90 border-rose-400/50 text-white'
    };

    const icons = {
      success: 'check-circle-2',
      info: 'info',
      error: 'alert-circle'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-sm font-medium animate-slide-down transition-all ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  // Clipboard copy
  async copyText(text, successMsg = 'Berhasil disalin!') {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.showToast(successMsg, 'success');
      return true;
    } catch (err) {
      console.error('Failed to copy text:', err);
      this.showToast('Gagal menyalin teks', 'error');
      return false;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
