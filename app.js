// ========================================================
// DIYORBEK ALIKUZIEV CRM - CLIENT SCRIPT (app.js)
// 2 ta filial: Al-Farg'oniy (yangiqo'rg'on) & Al-Farg'oniy (uchko'prik)
// Admin: dalikuziev / Dyrbk41Aiuie)
// Mehmonlar: Faqat ko'rish rejimi (Read-only)
// Standart to'lov: 300 000 so'm
// ========================================================

const STORAGE_KEYS = {
  BRANCHES: 'crm_branches_v5',
  STUDENTS: 'crm_students_v5',
  PAYMENTS: 'crm_payments_v5',
  BRANCH_MONTHS: 'crm_branch_months_v5',
  CURRENT_BRANCH: 'crm_current_branch_v5',
  CURRENT_MONTH: 'crm_current_month_v5',
  AUTH_TOKEN: 'crm_auth_token_v5',
  AUTH_USER: 'crm_auth_user_v5'
};

const DEFAULT_MONTHLY_FEE = 300000;
const ADMIN_CREDENTIALS = {
  username: 'dalikuziev',
  password: 'Dyrbk41Aiuie)',
  name: 'Diyorbek Alikuziev'
};

const MONTH_NAMES_UZ = {
  '01': 'Yanvar',
  '02': 'Fevral',
  '03': 'Mart',
  '04': 'Aprel',
  '05': 'May',
  '06': 'Iyun',
  '07': 'Iyul',
  '08': 'Avgust',
  '09': 'Sentabr',
  '10': 'Oktabr',
  '11': 'Noyabr',
  '12': 'Dekabr'
};

// Global State
let state = {
  isApiMode: false,
  auth: {
    isAuthenticated: false,
    token: null,
    user: null
  },
  branches: [
    { id: 'yangiqorgon', name: "Al-Farg'oniy (yangiqo'rg'on)", order_num: 1 },
    { id: 'uchkoprik', name: "Al-Farg'oniy (uchko'prik)", order_num: 2 }
  ],
  currentBranch: 'yangiqorgon',
  branchMonths: {
    'yangiqorgon': ['2026-10', '2026-11'],
    'uchkoprik': ['2026-10', '2026-11']
  },
  currentMonth: '2026-11',
  students: [],
  payments: {},
  selectedStudentIds: new Set(),
  filters: {
    search: '',
    group: 'all',
    status: 'all',
    sortBy: 'num_asc'
  }
};

// ========================================================
// 1. Dastlabki yuklash & Autentifikatsiya tekshiruvi
// ========================================================

async function initApp() {
  restoreAuth();
  await loadData();
  setupEventListeners();
  renderAll();
}

function restoreAuth() {
  const savedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const savedUser = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
  if (savedToken && savedUser) {
    try {
      state.auth.token = savedToken;
      state.auth.user = JSON.parse(savedUser);
      state.auth.isAuthenticated = true;
    } catch (e) {
      clearAuth();
    }
  }
}

function clearAuth() {
  state.auth.isAuthenticated = false;
  state.auth.token = null;
  state.auth.user = null;
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.auth.token) {
    headers['Authorization'] = `Bearer ${state.auth.token}`;
  }
  return headers;
}

async function loadData() {
  try {
    const res = await fetch('/api/bootstrap', {
      headers: getAuthHeaders(),
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        state.isApiMode = true;
        state.branches = data.branches || state.branches;
        state.branchMonths = data.branch_months || state.branchMonths;
        state.students = (data.students || []).map(s => ({
          id: s.id,
          branch_id: s.branch_id,
          name: s.name,
          phone: s.phone,
          group: s.group_name || '1-guruh',
          monthlyFee: s.monthly_fee || DEFAULT_MONTHLY_FEE,
          status: s.status || 'active'
        }));

        state.payments = {};
        (data.payments || []).forEach(p => {
          if (!state.payments[p.branch_id]) state.payments[p.branch_id] = {};
          if (!state.payments[p.branch_id][p.month_key]) state.payments[p.branch_id][p.month_key] = {};
          state.payments[p.branch_id][p.month_key][p.student_id] = {
            paid: !!p.paid,
            amount: p.amount,
            date: p.pay_date,
            note: p.note
          };
        });

        // Server auth holatini tasdiqlash
        if (state.auth.token && data.is_admin === false) {
          clearAuth();
        }

        const savedBranch = localStorage.getItem(STORAGE_KEYS.CURRENT_BRANCH);
        if (savedBranch && state.branches.some(b => b.id === savedBranch)) {
          state.currentBranch = savedBranch;
        }

        const monthsForBranch = state.branchMonths[state.currentBranch] || ['2026-10', '2026-11'];
        const savedMonth = localStorage.getItem(STORAGE_KEYS.CURRENT_MONTH);
        if (savedMonth && monthsForBranch.includes(savedMonth)) {
          state.currentMonth = savedMonth;
        } else {
          state.currentMonth = monthsForBranch[monthsForBranch.length - 1];
        }

        return;
      }
    }
  } catch (e) {
    console.log("Offline mode activated");
  }

  // OFFLINE REJIM
  state.isApiMode = false;

  const savedBranch = localStorage.getItem(STORAGE_KEYS.CURRENT_BRANCH);
  if (savedBranch) state.currentBranch = savedBranch;

  const savedMonths = localStorage.getItem(STORAGE_KEYS.BRANCH_MONTHS);
  if (savedMonths) {
    try { state.branchMonths = JSON.parse(savedMonths); } catch (e) {}
  } else if (typeof INITIAL_BRANCH_MONTHS !== 'undefined') {
    state.branchMonths = INITIAL_BRANCH_MONTHS;
  }

  const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
  if (savedStudents) {
    try { state.students = JSON.parse(savedStudents); } catch (e) { state.students = []; }
  }

  if (!state.students || state.students.length === 0) {
    if (typeof INITIAL_BRANCH_STUDENTS !== 'undefined' && Array.isArray(INITIAL_BRANCH_STUDENTS)) {
      state.students = INITIAL_BRANCH_STUDENTS.map(s => ({
        id: s.id,
        branch_id: s.branch_id,
        name: s.name,
        phone: s.phone,
        group: s.group_name || '1-guruh',
        monthlyFee: s.monthly_fee || DEFAULT_MONTHLY_FEE,
        status: s.status || 'active'
      }));
    }
    saveLocalStudents();
  }

  const savedPayments = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
  if (savedPayments) {
    try { state.payments = JSON.parse(savedPayments); } catch (e) { state.payments = {}; }
  } else {
    state.payments = {};
    if (typeof INITIAL_BRANCH_PAYMENTS !== 'undefined' && Array.isArray(INITIAL_BRANCH_PAYMENTS)) {
      INITIAL_BRANCH_PAYMENTS.forEach(p => {
        if (!state.payments[p.branch_id]) state.payments[p.branch_id] = {};
        if (!state.payments[p.branch_id][p.month_key]) state.payments[p.branch_id][p.month_key] = {};
        state.payments[p.branch_id][p.month_key][p.student_id] = {
          paid: !!p.paid,
          amount: p.amount,
          date: p.pay_date,
          note: p.note
        };
      });
    }
    saveLocalPayments();
  }

  const branchMonthsList = state.branchMonths[state.currentBranch] || ['2026-10', '2026-11'];
  state.currentMonth = branchMonthsList[branchMonthsList.length - 1];
}

function saveLocalStudents() {
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(state.students));
}

function saveLocalPayments() {
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(state.payments));
}

function saveLocalMonths() {
  localStorage.setItem(STORAGE_KEYS.BRANCH_MONTHS, JSON.stringify(state.branchMonths));
  localStorage.setItem(STORAGE_KEYS.CURRENT_MONTH, state.currentMonth);
}

// ========================================================
// 2. LOGIN & LOGOUT (AUTHENTICATION)
// ========================================================

function openLoginModal() {
  const modalHtml = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 fade-in" id="loginModal">
      <div class="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-slate-900 p-5 text-white text-center">
          <div class="w-12 h-12 rounded-xl bg-blue-600 mx-auto flex items-center justify-center mb-2 shadow-md">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h3 class="text-base font-black tracking-tight">Tizimga Kirish</h3>
          <p class="text-xs text-slate-400 mt-0.5">Diyorbek Alikuziev Administrator Paneli</p>
        </div>

        <form id="loginForm" onsubmit="handleLoginSubmit(event)" class="p-6 space-y-4">
          <div id="loginErrorAlert" class="hidden p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700"></div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Login</label>
            <input type="text" id="loginUsernameInput" required autocomplete="username"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm font-semibold text-slate-900">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Parol</label>
            <div class="relative">
              <input type="password" id="loginPasswordInput" required autocomplete="current-password"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm font-mono text-slate-900 pr-10">
              <button type="button" onclick="togglePasswordVisibility()" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                👁️
              </button>
            </div>
          </div>

          <div class="pt-2 flex gap-2">
            <button type="button" onclick="closeModal('loginModal')" class="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition text-xs">
              Bekor qilish
            </button>
            <button type="submit" id="loginSubmitBtn" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition text-xs">
              Kirish 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function togglePasswordVisibility() {
  const input = document.getElementById('loginPasswordInput');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsernameInput').value.trim();
  const password = document.getElementById('loginPasswordInput').value;
  const errorAlert = document.getElementById('loginErrorAlert');
  const submitBtn = document.getElementById('loginSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.textContent = "Tekshirilmoqda...";

  // 1. Agar Server API rejimi bo'lsa
  if (state.isApiMode) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        state.auth.token = data.token;
        state.auth.user = data.user;
        state.auth.isAuthenticated = true;
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
        localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(data.user));

        closeModal('loginModal');
        renderAll();
        showToast(`Xush kelibsiz, ${data.user.name}! (Admin rejimi)`, 'success');
        return;
      } else {
        throw new Error(data.error || "Login yoki parol noto'g'ri!");
      }
    } catch (err) {
      errorAlert.textContent = err.message;
      errorAlert.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = "Kirish 🚀";
      return;
    }
  }

  // 2. Offline rejim tekshiruvi
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    const fakeToken = 'offline_admin_token_' + Date.now();
    const user = { name: ADMIN_CREDENTIALS.name, username: ADMIN_CREDENTIALS.username };
    state.auth.token = fakeToken;
    state.auth.user = user;
    state.auth.isAuthenticated = true;
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, fakeToken);
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));

    closeModal('loginModal');
    renderAll();
    showToast(`Xush kelibsiz, ${user.name}! (Admin rejimi)`, 'success');
  } else {
    errorAlert.textContent = "Login yoki parol noto'g'ri! Iltimos qaytadan urinib ko'ring.";
    errorAlert.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = "Kirish 🚀";
  }
}

async function logout() {
  if (state.isApiMode && state.auth.token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ token: state.auth.token })
      });
    } catch (e) {}
  }

  clearAuth();
  state.selectedStudentIds.clear();
  renderAll();
  showToast("Tizimdan chiqildi. Siz hozir ko'rish rejimidisiz.", 'info');
}

function checkAdminPermission() {
  if (!state.auth.isAuthenticated) {
    showToast("⚠️ O'zgartirish uchun administrator sifatida tizimga kiring!", 'error');
    openLoginModal();
    return false;
  }
  return true;
}

// ========================================================
// 3. Yordamchilar (Helpers)
// ========================================================

function formatMoney(amount) {
  if (!amount && amount !== 0) return '0';
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parts[0];
  const m = parts[1];
  const name = MONTH_NAMES_UZ[m] || m;
  return `${name}, ${year}`;
}

function getNextMonthKey(currentKey) {
  if (!currentKey) return '2026-12';
  const parts = currentKey.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getBranchName(branchId) {
  const b = state.branches.find(x => x.id === branchId);
  return b ? b.name : branchId;
}

// ========================================================
// 4. Filiallar & Oylar Boshqaruvi
// ========================================================

function switchBranch(branchId) {
  if (state.currentBranch === branchId) return;
  state.currentBranch = branchId;
  localStorage.setItem(STORAGE_KEYS.CURRENT_BRANCH, branchId);

  const branchMonths = state.branchMonths[branchId] || ['2026-10', '2026-11'];
  if (!branchMonths.includes(state.currentMonth)) {
    state.currentMonth = branchMonths[branchMonths.length - 1];
  }

  state.selectedStudentIds.clear();
  state.filters.group = 'all';

  renderAll();
  showToast(`🏢 Bo'lim: ${getBranchName(branchId)}`, 'info');
}

function switchMonth(newMonth) {
  const branchId = state.currentBranch;
  const branchMonths = state.branchMonths[branchId] || [];
  if (!branchMonths.includes(newMonth)) return;

  state.currentMonth = newMonth;
  localStorage.setItem(STORAGE_KEYS.CURRENT_MONTH, state.currentMonth);

  if (!state.payments[branchId]) state.payments[branchId] = {};
  if (!state.payments[branchId][newMonth]) state.payments[branchId][newMonth] = {};

  renderAll();
  showToast(`📅 "${formatMonthLabel(newMonth)}" ko'rsatilmoqda`, 'info');
}

async function startNewMonth(monthKey) {
  if (!checkAdminPermission()) return;
  if (!monthKey) return;
  const branchId = state.currentBranch;

  if (state.isApiMode) {
    try {
      const res = await fetch('/api/months/start-new', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ branch_id: branchId, month_key: monthKey, reset_payments: true })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Xatolik');
    } catch (err) {
      alert("Xatolik: " + err.message);
      return;
    }
  }

  if (!state.branchMonths[branchId]) state.branchMonths[branchId] = [];
  if (!state.branchMonths[branchId].includes(monthKey)) {
    state.branchMonths[branchId].push(monthKey);
    state.branchMonths[branchId].sort();
  }

  if (!state.payments[branchId]) state.payments[branchId] = {};
  state.payments[branchId][monthKey] = {};

  state.currentMonth = monthKey;
  saveLocalMonths();
  saveLocalPayments();

  renderAll();
  showToast(`✅ "${formatMonthLabel(monthKey)}" oyi toza holda boshlandi!`, 'success');
}

// ========================================================
// 5. To'lov Amallari (Admin Himoyasi Bilan)
// ========================================================

async function quickPay(studentId) {
  if (!checkAdminPermission()) return;

  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;
  const fee = student.monthlyFee || DEFAULT_MONTHLY_FEE;
  const todayStr = new Date().toISOString().split('T')[0];

  if (state.isApiMode) {
    try {
      const res = await fetch('/api/payments/quick', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ branch_id: branchId, month_key: monthKey, student_id: studentId })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  if (!state.payments[branchId]) state.payments[branchId] = {};
  if (!state.payments[branchId][monthKey]) state.payments[branchId][monthKey] = {};

  state.payments[branchId][monthKey][studentId] = {
    paid: true,
    amount: fee,
    date: todayStr,
    note: "To'liq to'landi"
  };

  saveLocalPayments();
  renderAll();
  showToast(`✅ ${student.name} uchun ${formatMoney(fee)} so'm to'landi!`, 'success');
}

async function cancelPay(studentId) {
  if (!checkAdminPermission()) return;

  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;

  if (state.isApiMode) {
    try {
      await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ branch_id: branchId, month_key: monthKey, student_id: studentId })
      });
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  if (state.payments[branchId] && state.payments[branchId][monthKey]) {
    delete state.payments[branchId][monthKey][studentId];
  }

  saveLocalPayments();
  renderAll();
  showToast(`↩️ ${student.name} to'lovi bekor qilindi`, 'warning');
}

function openCustomPayModal(studentId) {
  if (!checkAdminPermission()) return;

  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;
  const pay = (state.payments[branchId] && state.payments[branchId][monthKey] && state.payments[branchId][monthKey][studentId]) || {};

  const currentAmount = pay.amount || student.monthlyFee || DEFAULT_MONTHLY_FEE;
  const currentDate = pay.date || new Date().toISOString().split('T')[0];
  const currentNote = pay.note || '';

  const modalHtml = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 fade-in" id="customPayModal">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-blue-600 p-5 text-white">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              To'lovni kiritish / o'zgartirish
            </h3>
            <button onclick="closeModal('customPayModal')" class="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
          </div>
          <p class="text-blue-100 text-xs mt-1">${student.name} &bull; ${student.group || 'Guruhsiz'}</p>
        </div>

        <form id="customPayForm" onsubmit="handleCustomPaySubmit(event, '${studentId}')" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">To'lov summasi (so'm)</label>
            <div class="relative">
              <input type="number" id="payAmountInput" value="${currentAmount}" required min="0" step="1000"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 font-bold text-lg text-slate-900">
              <span class="absolute right-3 top-3 text-xs font-semibold text-slate-400">SO'M</span>
            </div>
            <div class="flex gap-2 mt-2">
              <button type="button" onclick="document.getElementById('payAmountInput').value = 300000" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-lg">300 000</button>
              <button type="button" onclick="document.getElementById('payAmountInput').value = 250000" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1 rounded-lg">250 000</button>
              <button type="button" onclick="document.getElementById('payAmountInput').value = 200000" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1 rounded-lg">200 000</button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">To'lov sanasi</label>
            <input type="date" id="payDateInput" value="${currentDate}" required
              class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Izoh / To'lov usuli</label>
            <input type="text" id="payNoteInput" value="${escapeHtml(currentNote)}" placeholder="Masalan: Naqd, Click, Payme..."
              class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div class="pt-3 flex gap-3">
            <button type="button" onclick="closeModal('customPayModal')" class="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition">
              Bekor qilish
            </button>
            <button type="submit" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition">
              Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modalHtml;
}

async function handleCustomPaySubmit(event, studentId) {
  event.preventDefault();
  if (!checkAdminPermission()) return;

  const amount = parseFloat(document.getElementById('payAmountInput').value) || 0;
  const date = document.getElementById('payDateInput').value;
  const note = document.getElementById('payNoteInput').value.trim();

  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;

  if (state.isApiMode) {
    try {
      await fetch('/api/payments/custom', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          branch_id: branchId,
          month_key: monthKey,
          student_id: studentId,
          amount: amount,
          pay_date: date,
          note: note
        })
      });
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  if (!state.payments[branchId]) state.payments[branchId] = {};
  if (!state.payments[branchId][monthKey]) state.payments[branchId][monthKey] = {};

  if (amount > 0) {
    state.payments[branchId][monthKey][studentId] = {
      paid: true,
      amount: amount,
      date: date,
      note: note
    };
  } else {
    delete state.payments[branchId][monthKey][studentId];
  }

  saveLocalPayments();
  closeModal('customPayModal');
  renderAll();
  showToast("To'lov ma'lumotlari saqlandi!", 'success');
}

// ========================================================
// 6. O'quvchi Qo'shish & O'chirish (Admin Himoyasi Bilan)
// ========================================================

function openAddStudentModal() {
  if (!checkAdminPermission()) return;

  const modalHtml = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 fade-in" id="studentModal">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-blue-600 p-5 text-white">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
              Yangi O'quvchi Qo'shish
            </h3>
            <button onclick="closeModal('studentModal')" class="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
          </div>
          <p class="text-blue-100 text-xs mt-1">Diyorbek Alikuziev Administrator Paneli</p>
        </div>

        <form id="addStudentForm" onsubmit="handleAddStudentSubmit(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Filial / Bo'lim *</label>
            <select id="stdBranchInput" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 font-semibold text-sm">
              <option value="yangiqorgon" ${state.currentBranch === 'yangiqorgon' ? 'selected' : ''}>Al-Farg'oniy (yangiqo'rg'on)</option>
              <option value="uchkoprik" ${state.currentBranch === 'uchkoprik' ? 'selected' : ''}>Al-Farg'oniy (uchko'prik)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Ism va Familiya *</label>
            <input type="text" id="stdNameInput" required placeholder="Masalan: Azizbek Karimov"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Telefon raqam *</label>
            <input type="text" id="stdPhoneInput" required placeholder="Masalan: +998 90-123-4567"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Guruh</label>
            <select id="stdGroupInput" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm font-medium">
              <option value="1-guruh">1-guruh</option>
              <option value="2-guruh">2-guruh</option>
              <option value="3-guruh">3-guruh</option>
              <option value="Boshqa guruh">Boshqa guruh</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Standart oylik to'lov summasi (so'm)</label>
            <input type="number" id="stdFeeInput" value="${DEFAULT_MONTHLY_FEE}" required step="1000"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm font-bold text-slate-900">
          </div>

          <div class="pt-3 flex gap-3">
            <button type="button" onclick="closeModal('studentModal')" class="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition">
              Bekor qilish
            </button>
            <button type="submit" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition">
              Qo'shish
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modalHtml;
}

async function handleAddStudentSubmit(event) {
  event.preventDefault();
  if (!checkAdminPermission()) return;

  const branch_id = document.getElementById('stdBranchInput').value;
  const name = document.getElementById('stdNameInput').value.trim();
  let phone = document.getElementById('stdPhoneInput').value.trim();
  const group = document.getElementById('stdGroupInput').value;
  const monthlyFee = parseFloat(document.getElementById('stdFeeInput').value) || DEFAULT_MONTHLY_FEE;

  if (!phone.startsWith('+998') && !phone.startsWith('998')) {
    phone = '+998 ' + phone;
  }

  let newStudent = null;

  if (state.isApiMode) {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          branch_id: branch_id,
          name: name,
          phone: phone,
          group_name: group,
          monthly_fee: monthlyFee
        })
      });
      const data = await res.json();
      if (data.ok && data.student) {
        newStudent = {
          id: data.student.id,
          branch_id: data.student.branch_id,
          name: data.student.name,
          phone: data.student.phone,
          group: data.student.group_name,
          monthlyFee: data.student.monthly_fee,
          status: 'active'
        };
      } else {
        throw new Error(data.error || "Qo'shishda xatolik");
      }
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  if (!newStudent) {
    newStudent = {
      id: `std_${branch_id}_${Date.now()}`,
      branch_id: branch_id,
      name: name,
      phone: phone,
      group: group,
      monthlyFee: monthlyFee,
      status: 'active'
    };
  }

  state.students.push(newStudent);
  saveLocalStudents();

  if (state.currentBranch !== branch_id) {
    state.currentBranch = branch_id;
  }

  closeModal('studentModal');
  renderAll();
  showToast(`✅ "${name}" ${getBranchName(branch_id)} bo'limiga qo'shildi!`, 'success');
}

async function deleteSingleStudent(studentId) {
  if (!checkAdminPermission()) return;

  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const conf = confirm(
    `Haqiqatan ham "${student.name}"ni ro'yxatdan butunlay o'chirmoqchimisiz?\n\nBo'lim: ${getBranchName(student.branch_id)}`
  );
  if (!conf) return;

  if (state.isApiMode) {
    try {
      const res = await fetch('/api/students', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: studentId })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  state.students = state.students.filter(s => s.id !== studentId);
  state.selectedStudentIds.delete(studentId);

  Object.keys(state.payments).forEach(bid => {
    Object.keys(state.payments[bid]).forEach(mk => {
      if (state.payments[bid][mk][studentId]) {
        delete state.payments[bid][mk][studentId];
      }
    });
  });

  saveLocalStudents();
  saveLocalPayments();
  renderAll();
  showToast(`🗑️ "${student.name}" muvaffaqiyatli o'chirildi!`, 'warning');
}

async function deleteSelectedStudents() {
  if (!checkAdminPermission()) return;

  const count = state.selectedStudentIds.size;
  if (count === 0) return;

  const conf = confirm(
    `Diqqat! Belgilangan ${count} ta o'quvchini butunlay o'chirmoqchimisiz?`
  );
  if (!conf) return;

  const idsArray = Array.from(state.selectedStudentIds);

  if (state.isApiMode) {
    try {
      const res = await fetch('/api/students/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ student_ids: idsArray })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  state.students = state.students.filter(s => !state.selectedStudentIds.has(s.id));

  idsArray.forEach(sid => {
    Object.keys(state.payments).forEach(bid => {
      Object.keys(state.payments[bid]).forEach(mk => {
        if (state.payments[bid][mk][sid]) {
          delete state.payments[bid][mk][sid];
        }
      });
    });
  });

  state.selectedStudentIds.clear();
  saveLocalStudents();
  saveLocalPayments();
  renderAll();
  showToast(`🗑️ ${count} ta o'quvchi muvaffaqiyatli o'chirildi!`, 'warning');
}

function toggleStudentSelection(studentId, isChecked) {
  if (isChecked) {
    state.selectedStudentIds.add(studentId);
  } else {
    state.selectedStudentIds.delete(studentId);
  }
  updateBulkDeleteBar();
}

function toggleSelectAll(isChecked) {
  const currentBranchStudents = getFilteredStudents();
  if (isChecked) {
    currentBranchStudents.forEach(s => state.selectedStudentIds.add(s.id));
  } else {
    currentBranchStudents.forEach(s => state.selectedStudentIds.delete(s.id));
  }
  renderStudentTable();
  updateBulkDeleteBar();
}

function updateBulkDeleteBar() {
  const bar = document.getElementById('bulkActionsBar');
  const countSpan = document.getElementById('selectedCountText');
  if (!bar) return;

  if (state.auth.isAuthenticated && state.selectedStudentIds.size > 0) {
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    if (countSpan) countSpan.textContent = `${state.selectedStudentIds.size} ta o'quvchi tanlandi`;
  } else {
    bar.classList.add('hidden');
    bar.classList.remove('flex');
  }
}

function openEditStudentModal(studentId) {
  if (!checkAdminPermission()) return;

  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const modalHtml = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 fade-in" id="studentModal">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-slate-900 p-5 text-white">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              O'quvchini tahrirlash
            </h3>
            <button onclick="closeModal('studentModal')" class="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
          </div>
          <p class="text-slate-300 text-xs mt-1">${student.name}</p>
        </div>

        <form id="editStudentForm" onsubmit="handleEditStudentSubmit(event, '${studentId}')" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Filial / Bo'lim *</label>
            <select id="stdBranchInput" class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm font-semibold">
              <option value="yangiqorgon" ${student.branch_id === 'yangiqorgon' ? 'selected' : ''}>Al-Farg'oniy (yangiqo'rg'on)</option>
              <option value="uchkoprik" ${student.branch_id === 'uchkoprik' ? 'selected' : ''}>Al-Farg'oniy (uchko'prik)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Ism va Familiya *</label>
            <input type="text" id="stdNameInput" value="${escapeHtml(student.name)}" required
              class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Telefon raqam *</label>
            <input type="text" id="stdPhoneInput" value="${escapeHtml(student.phone)}" required
              class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Guruh</label>
            <input type="text" id="stdGroupInput" value="${escapeHtml(student.group || '1-guruh')}"
              class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Standart oylik to'lovi (so'm)</label>
            <input type="number" id="stdFeeInput" value="${student.monthlyFee || DEFAULT_MONTHLY_FEE}" required step="1000"
              class="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 text-sm font-bold text-slate-900">
          </div>

          <div class="pt-3 flex gap-2">
            <button type="button" onclick="closeModal('studentModal'); deleteSingleStudent('${studentId}')" class="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-bold text-xs transition">
              🗑️ O'chirish
            </button>
            <button type="button" onclick="closeModal('studentModal')" class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition">
              Bekor qilish
            </button>
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition">
              Saqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modalHtml;
}

async function handleEditStudentSubmit(event, studentId) {
  event.preventDefault();
  if (!checkAdminPermission()) return;

  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const branch_id = document.getElementById('stdBranchInput').value;
  const name = document.getElementById('stdNameInput').value.trim();
  const phone = document.getElementById('stdPhoneInput').value.trim();
  const group = document.getElementById('stdGroupInput').value.trim();
  const monthlyFee = parseFloat(document.getElementById('stdFeeInput').value) || DEFAULT_MONTHLY_FEE;

  if (state.isApiMode) {
    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: studentId,
          branch_id: branch_id,
          name: name,
          phone: phone,
          group_name: group,
          monthly_fee: monthlyFee
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch (e) {
      alert("Xatolik: " + e.message);
      return;
    }
  }

  student.branch_id = branch_id;
  student.name = name;
  student.phone = phone;
  student.group = group;
  student.monthlyFee = monthlyFee;

  saveLocalStudents();
  closeModal('studentModal');
  renderAll();
  showToast("O'quvchi ma'lumotlari yangilandi!", 'success');
}

function openNewMonthModal() {
  if (!checkAdminPermission()) return;

  const nextMonthKey = getNextMonthKey(state.currentMonth);
  const nextMonthLabel = formatMonthLabel(nextMonthKey);
  const branchName = getBranchName(state.currentBranch);
  const currentBranchCount = state.students.filter(s => s.branch_id === state.currentBranch).length;

  const modalHtml = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 fade-in" id="newMonthModal">
      <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-blue-600 p-5 text-white">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Yangi oy boshlash
            </h3>
            <button onclick="closeModal('newMonthModal')" class="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
          </div>
          <p class="text-blue-100 text-xs mt-1">${branchName}</p>
        </div>

        <form id="newMonthForm" onsubmit="handleNewMonthSubmit(event)" class="p-6 space-y-4">
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
            <div class="font-bold text-sm text-blue-800 flex items-center gap-1.5">
              <span>✨</span> Yangi toza varaq ochish:
            </div>
            <p>1. <strong>${branchName}</strong> bo'limidagi barcha <strong>${currentBranchCount} ta o'quvchi</strong> yangi oyga to'liq o'tadi.</p>
            <p>2. Yangi oy to'lovlari <strong>MUTLAQO TOZA (0 so'm)</strong> holatda ochiladi.</p>
            <p>3. Oktyabr va boshqa oylar arxivda to'liq saqlanadi.</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Oyni tanlang yoki kiriting</label>
            <input type="month" id="newMonthInput" value="${nextMonthKey}" required
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 font-bold text-slate-900">
            <p class="text-xs text-slate-500 mt-1">Tavsiya qilinayotgan oy: <strong>${nextMonthLabel}</strong></p>
          </div>

          <div class="pt-2 flex gap-3">
            <button type="button" onclick="closeModal('newMonthModal')" class="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition">
              Bekor qilish
            </button>
            <button type="submit" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition">
              Oyni boshlash 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function handleNewMonthSubmit(event) {
  event.preventDefault();
  const selectedMonth = document.getElementById('newMonthInput').value;
  if (!selectedMonth) return;

  closeModal('newMonthModal');
  startNewMonth(selectedMonth);
}

// ========================================================
// 7. Eslatma & Excel
// ========================================================

function openReminderModal(studentId) {
  const student = state.students.find(s => s.id === studentId);
  if (!student) return;

  const fee = student.monthlyFee || DEFAULT_MONTHLY_FEE;
  const monthName = formatMonthLabel(state.currentMonth);
  const branchName = getBranchName(student.branch_id);
  const messageText = `Assalomu alaykum, hurmatli ${student.name}! Sizning ${monthName} oyi uchun o'quv kursi to'lovingiz (${formatMoney(fee)} so'm) hali to'lanmagan. Iltimos, to'lovni o'z vaqtida amalga oshirishingizni so'raymiz. Hurmat bilan, ${branchName}.`;

  const cleanPhone = student.phone.replace(/[^0-9]/g, '');

  const modalHtml = `
    <div class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 fade-in" id="reminderModal">
      <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        <div class="bg-blue-600 p-5 text-white">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              To'lov eslatmasi (Telegram / SMS)
            </h3>
            <button onclick="closeModal('reminderModal')" class="text-white/80 hover:text-white text-2xl font-bold leading-none">&times;</button>
          </div>
          <p class="text-blue-100 text-xs mt-1">${student.name} &bull; ${student.phone}</p>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Xabar matni:</label>
            <textarea id="reminderMessageText" rows="4"
              class="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600">${messageText}</textarea>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onclick="copyReminderText()" class="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
              Nusxa olish
            </button>
            <a href="https://t.me/+${cleanPhone}" target="_blank" class="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.963z"/></svg>
              Telegramda ochish
            </a>
            <a href="tel:+${cleanPhone}" class="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              Qo'ng'iroq
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function copyReminderText() {
  const textarea = document.getElementById('reminderMessageText');
  textarea.select();
  document.execCommand('copy');
  showToast("📋 Xabar matni nusxalandi!", 'info');
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert("Excel kutubxonasi mavjud emas.");
    return;
  }

  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;
  const branchName = getBranchName(branchId);
  const currentBranchStudents = state.students.filter(s => s.branch_id === branchId);
  const branchPayments = (state.payments[branchId] && state.payments[branchId][monthKey]) || {};

  const rows = [
    [`Muallif: Diyorbek Alikuziev`, `Bo'lim: ${branchName}`, `Davr: ${formatMonthLabel(monthKey)}`],
    ["№", "Ism va Familiya", "Guruh", "Telefon Raqam", "To'lov Holati", "To'langan Summa (so'm)", "To'lov Sanasi", "Izoh"]
  ];

  currentBranchStudents.forEach((student, index) => {
    const pay = branchPayments[student.id] || {};
    const isPaid = !!pay.paid;
    const amount = isPaid ? (pay.amount || student.monthlyFee || DEFAULT_MONTHLY_FEE) : 0;

    rows.push([
      index + 1,
      student.name,
      student.group || '1-guruh',
      student.phone,
      isPaid ? "TO'LANGAN" : "TO'LANMAGAN",
      amount,
      pay.date || '',
      pay.note || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "To'lovlar");

  const fileName = `Diyorbek_Alikuziev_${branchName.replace(/[^a-zA-Z0-9]/g, '_')}_${monthKey}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`📊 Excel fayl yuklab olindi: ${fileName}`, 'success');
}

// ========================================================
// 8. Renderlash (UI Rendering & RBAC)
// ========================================================

function renderAll() {
  renderUserProfile();
  renderBranchTabs();
  renderMonthSelector();
  renderStatistics();
  renderGroupPills();
  renderStudentTable();
  updateBulkDeleteBar();
}

function renderUserProfile() {
  const container = document.getElementById('userProfileSection');
  const roleBadge = document.getElementById('roleBadge');
  const adminButtons = document.getElementById('adminActionButtons');
  const guestBanner = document.getElementById('guestWarningBanner');
  const thCheckbox = document.getElementById('thCheckbox');
  const thActions = document.getElementById('thActions');
  const tableHelpText = document.getElementById('tableHelpText');

  if (state.auth.isAuthenticated) {
    // ADMIN HOLATI (Diyorbek Alikuziev)
    if (roleBadge) {
      roleBadge.textContent = "Administrator";
      roleBadge.className = "px-2 py-0.2 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300";
    }
    if (adminButtons) adminButtons.classList.remove('hidden');
    if (guestBanner) guestBanner.classList.add('hidden');
    if (thCheckbox) thCheckbox.classList.remove('hidden');
    if (thActions) thActions.textContent = "Boshqaruv Amallari";
    if (tableHelpText) tableHelpText.textContent = "Administrator: o'zgartirish va to'lov qabul qilish faol";

    if (container) {
      container.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div class="text-right">
            <div class="text-xs font-black text-slate-900 tracking-tight leading-tight">Diyorbek Alikuziev</div>
            <div class="text-[10px] font-bold text-emerald-700 leading-tight">Admin</div>
          </div>
          <button onclick="logout()" title="Tizimdan chiqish" class="ml-1 p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-xl transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>
      `;
    }
  } else {
    // MEHMON HOLATI (READ-ONLY)
    if (roleBadge) {
      roleBadge.textContent = "Mehmon (Ko'rish)";
      roleBadge.className = "px-2 py-0.2 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200";
    }
    if (adminButtons) adminButtons.classList.add('hidden');
    if (guestBanner) guestBanner.classList.remove('hidden');
    if (thCheckbox) thCheckbox.classList.add('hidden');
    if (thActions) thActions.textContent = "Aloqa";
    if (tableHelpText) tableHelpText.textContent = "Ko'rish rejimi: o'zgartirish uchun tizimga kiring";

    if (container) {
      container.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xs font-black text-slate-800 hidden sm:inline tracking-tight">Diyorbek Alikuziev</span>
          <button onclick="openLoginModal()" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 active:scale-95">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
            <span>Kirish</span>
          </button>
        </div>
      `;
    }
  }
}

function renderBranchTabs() {
  const container = document.getElementById('branchTabsContainer');
  if (!container) return;

  const yangiqorgonCount = state.students.filter(s => s.branch_id === 'yangiqorgon').length;
  const uchkoprikCount = state.students.filter(s => s.branch_id === 'uchkoprik').length;

  container.innerHTML = `
    <!-- 1-bo'lim: Al-Farg'oniy (yangiqo'rg'on) -->
    <button onclick="switchBranch('yangiqorgon')"
      class="flex-1 py-3 px-5 rounded-xl border text-left transition relative flex items-center justify-between ${
        state.currentBranch === 'yangiqorgon' ? 'branch-tab-active' : 'branch-tab-inactive'
      }">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
          state.currentBranch === 'yangiqorgon' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
        }">
          1
        </div>
        <div>
          <div class="font-bold text-sm tracking-tight">Al-Farg'oniy (yangiqo'rg'on)</div>
          <div class="text-[11px] ${state.currentBranch === 'yangiqorgon' ? 'text-slate-300' : 'text-slate-500'}">
            Chap tarafdagi o'quvchilar
          </div>
        </div>
      </div>
      <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
        state.currentBranch === 'yangiqorgon' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
      }">
        ${yangiqorgonCount} o'quvchi
      </span>
    </button>

    <!-- 2-bo'lim: Al-Farg'oniy (uchko'prik) -->
    <button onclick="switchBranch('uchkoprik')"
      class="flex-1 py-3 px-5 rounded-xl border text-left transition relative flex items-center justify-between ${
        state.currentBranch === 'uchkoprik' ? 'branch-tab-active' : 'branch-tab-inactive'
      }">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
          state.currentBranch === 'uchkoprik' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
        }">
          2
        </div>
        <div>
          <div class="font-bold text-sm tracking-tight">Al-Farg'oniy (uchko'prik)</div>
          <div class="text-[11px] ${state.currentBranch === 'uchkoprik' ? 'text-slate-300' : 'text-slate-500'}">
            O'ng tarafdagi o'quvchilar
          </div>
        </div>
      </div>
      <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
        state.currentBranch === 'uchkoprik' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
      }">
        ${uchkoprikCount} o'quvchi
      </span>
    </button>
  `;
}

function renderMonthSelector() {
  const monthSelect = document.getElementById('monthSelector');
  const branchMonths = state.branchMonths[state.currentBranch] || ['2026-10', '2026-11'];

  if (monthSelect) {
    monthSelect.innerHTML = branchMonths.map(m => {
      const isOctober = m === '2026-10';
      const label = isOctober ? `📅 ${formatMonthLabel(m)} (100% Tarix)` : `📅 ${formatMonthLabel(m)}`;
      return `
        <option value="${m}" ${m === state.currentMonth ? 'selected' : ''}>
          ${label}
        </option>
      `;
    }).join('');
  }

  const curMonthBadge = document.getElementById('currentMonthBadge');
  if (curMonthBadge) {
    const isOct = state.currentMonth === '2026-10';
    curMonthBadge.textContent = `${getBranchName(state.currentBranch)} • ${formatMonthLabel(state.currentMonth)} ${isOct ? '(100% to\'langan)' : ''}`;
  }
}

function renderStatistics() {
  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;
  const currentBranchStudents = state.students.filter(s => s.branch_id === branchId);
  const currentPayments = (state.payments[branchId] && state.payments[branchId][monthKey]) || {};

  const totalStudents = currentBranchStudents.length;
  let paidCount = 0;
  let totalPaidAmount = 0;
  let totalExpectedAmount = 0;

  currentBranchStudents.forEach(student => {
    const fee = student.monthlyFee || DEFAULT_MONTHLY_FEE;
    totalExpectedAmount += fee;

    const p = currentPayments[student.id];
    if (p && p.paid) {
      paidCount++;
      totalPaidAmount += (p.amount || fee);
    }
  });

  const unpaidCount = totalStudents - paidCount;
  const remainingAmount = Math.max(0, totalExpectedAmount - totalPaidAmount);
  const percent = totalStudents > 0 ? Math.round((paidCount / totalStudents) * 100) : 0;

  safeSetText('statTotalStudents', `${totalStudents} ta`);
  safeSetText('statPaidCount', `${paidCount} ta`);
  safeSetText('statUnpaidCount', `${unpaidCount} ta`);
  safeSetText('statTotalPaid', `${formatMoney(totalPaidAmount)} so'm`);
  safeSetText('statExpectedTotal', `${formatMoney(totalExpectedAmount)} so'm`);
  safeSetText('statRemainingAmount', `${formatMoney(remainingAmount)} so'm`);
  safeSetText('statPaidPercent', `${percent}%`);

  const progressBar = document.getElementById('statProgressBar');
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
}

function renderGroupPills() {
  const container = document.getElementById('groupFilterContainer');
  if (!container) return;

  const currentBranchStudents = state.students.filter(s => s.branch_id === state.currentBranch);

  const groups = ['all', '1-guruh', '2-guruh', '3-guruh'];
  currentBranchStudents.forEach(s => {
    if (s.group && !groups.includes(s.group)) groups.push(s.group);
  });

  container.innerHTML = groups.map(grp => {
    const isActive = state.filters.group === grp;
    const count = grp === 'all'
      ? currentBranchStudents.length
      : currentBranchStudents.filter(s => s.group === grp).length;

    const label = grp === 'all' ? 'Barcha guruhlar' : grp;

    return `
      <button onclick="setGroupFilter('${grp}')"
        class="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
          isActive
            ? 'bg-blue-600 text-white shadow-xs'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
        }">
        ${label}
        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${
          isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
        }">${count}</span>
      </button>
    `;
  }).join('');
}

function getFilteredStudents() {
  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;
  const currentPayments = (state.payments[branchId] && state.payments[branchId][monthKey]) || {};

  let list = state.students.filter(s => s.branch_id === branchId);

  if (state.filters.group !== 'all') {
    list = list.filter(s => s.group === state.filters.group);
  }

  if (state.filters.status === 'paid') {
    list = list.filter(s => currentPayments[s.id] && currentPayments[s.id].paid);
  } else if (state.filters.status === 'unpaid') {
    list = list.filter(s => !currentPayments[s.id] || !currentPayments[s.id].paid);
  }

  if (state.filters.search.trim()) {
    const q = state.filters.search.toLowerCase().trim();
    list = list.filter(s => {
      const name = (s.name || '').toLowerCase();
      const phone = (s.phone || '').replace(/[^0-9]/g, '');
      const cleanQ = q.replace(/[^0-9]/g, '');
      return name.includes(q) || (cleanQ.length > 2 && phone.includes(cleanQ));
    });
  }

  list.sort((a, b) => {
    if (state.filters.sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    } else if (state.filters.sortBy === 'status_unpaid_first') {
      const aPaid = currentPayments[a.id] && currentPayments[a.id].paid ? 1 : 0;
      const bPaid = currentPayments[b.id] && currentPayments[b.id].paid ? 1 : 0;
      return aPaid - bPaid;
    } else if (state.filters.sortBy === 'status_paid_first') {
      const aPaid = currentPayments[a.id] && currentPayments[a.id].paid ? 1 : 0;
      const bPaid = currentPayments[b.id] && currentPayments[b.id].paid ? 1 : 0;
      return bPaid - aPaid;
    }
    return 0;
  });

  return list;
}

function renderStudentTable() {
  const tbody = document.getElementById('studentTableBody');
  const countBadge = document.getElementById('filteredCountBadge');
  const branchTitle = document.getElementById('currentBranchTableTitle');
  if (!tbody) return;

  const branchId = state.currentBranch;
  const monthKey = state.currentMonth;
  const branchName = getBranchName(branchId);
  const filteredList = getFilteredStudents();
  const currentPayments = (state.payments[branchId] && state.payments[branchId][monthKey]) || {};
  const isAdmin = state.auth.isAuthenticated;

  if (countBadge) countBadge.textContent = `${filteredList.length} ta o'quvchi`;
  if (branchTitle) branchTitle.textContent = `${branchName} — ${formatMonthLabel(monthKey)}`;

  const selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) {
    const allSelected = filteredList.length > 0 && filteredList.every(s => state.selectedStudentIds.has(s.id));
    selectAllCb.checked = allSelected;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isAdmin ? 8 : 7}" class="py-12 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center">
            <svg class="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <p class="font-bold text-slate-600 text-sm">O'quvchi topilmadi</p>
            <p class="text-xs text-slate-400 mt-1">Bu bo'limda hozircha o'quvchi yo'q yoki qidiruv mos kelmadi</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredList.map((student, index) => {
    const pay = currentPayments[student.id];
    const isPaid = !!(pay && pay.paid);
    const amount = isPaid ? (pay.amount || student.monthlyFee || DEFAULT_MONTHLY_FEE) : 0;
    const date = (pay && pay.date) || '';
    const note = (pay && pay.note) || '';
    const isSelected = state.selectedStudentIds.has(student.id);

    return `
      <tr class="table-row-hover border-b border-slate-100 transition ${isPaid ? 'table-row-paid bg-blue-50/10' : 'table-row-unpaid'}">
        <!-- Checkbox (FAQAT ADMIN) -->
        ${
          isAdmin
            ? `
              <td class="py-3 px-3 text-center w-8 no-print">
                <input type="checkbox" onchange="toggleStudentSelection('${student.id}', this.checked)" ${isSelected ? 'checked' : ''}
                  class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
              </td>
            `
            : ''
        }

        <!-- № -->
        <td class="py-3 px-3 text-xs font-bold text-slate-400 text-center w-10">
          ${index + 1}
        </td>

        <!-- Ism & Familiya -->
        <td class="py-3 px-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
              isPaid ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
            }">
              ${getInitials(student.name)}
            </div>
            <div>
              <div class="font-bold text-slate-900 text-sm">
                ${escapeHtml(student.name)}
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5 sm:hidden">
                ${escapeHtml(student.phone)} &bull; ${escapeHtml(student.group || '')}
              </div>
            </div>
          </div>
        </td>

        <!-- Guruh -->
        <td class="py-3 px-4 hidden sm:table-cell">
          <span class="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            ${escapeHtml(student.group || '1-guruh')}
          </span>
        </td>

        <!-- Telefon raqam -->
        <td class="py-3 px-4 hidden md:table-cell">
          <a href="tel:${student.phone.replace(/[^0-9+]/g, '')}" class="text-xs font-mono font-semibold text-slate-700 hover:text-blue-600 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            ${escapeHtml(student.phone)}
          </a>
        </td>

        <!-- To'lov holati -->
        <td class="py-3 px-4">
          ${
            isPaid
              ? `
                <div class="flex flex-col">
                  <span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold text-xs px-2.5 py-0.5 rounded-md w-max">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    To'langan
                  </span>
                  <span class="text-xs font-black text-slate-900 mt-1">
                    ${formatMoney(amount)} so'm
                  </span>
                  ${date ? `<span class="text-[10px] text-slate-400 font-medium">${date}</span>` : ''}
                </div>
              `
              : `
                <div class="flex flex-col">
                  <span class="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 font-bold text-xs px-2.5 py-0.5 rounded-md w-max">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    To'lanmagan
                  </span>
                  <span class="text-[11px] text-slate-500 font-medium mt-1">
                    Kutilmoqda: ${formatMoney(student.monthlyFee || DEFAULT_MONTHLY_FEE)} so'm
                  </span>
                </div>
              `
          }
        </td>

        <!-- Izoh -->
        <td class="py-3 px-4 hidden lg:table-cell text-xs text-slate-500 max-w-[130px] truncate">
          ${note ? `<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">${escapeHtml(note)}</span>` : '<span class="text-slate-300">-</span>'}
        </td>

        <!-- Amallar (FAQAT ADMIN O'ZGARTIRA OLADI, MEHMONDAGI HOLAT FAHM BILAN YASHIRILADI) -->
        <td class="py-3 px-4 text-right no-print">
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
            ${
              isAdmin
                ? `
                  ${
                    !isPaid
                      ? `
                        <button onclick="quickPay('${student.id}')"
                          title="To'lovni tasdiqlash (300 000 so'm)"
                          class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 active:scale-95">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                          To'landi
                        </button>

                        <button onclick="openCustomPayModal('${student.id}')"
                          title="Boshqa summa kiritish"
                          class="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition">
                          ✏️
                        </button>
                      `
                      : `
                        <button onclick="cancelPay('${student.id}')"
                          title="To'lovni bekor qilish"
                          class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                          Bekor
                        </button>

                        <button onclick="openCustomPayModal('${student.id}')"
                          title="To'lovni tahrirlash"
                          class="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition">
                          ✏️
                        </button>
                      `
                  }

                  <!-- Eslatma -->
                  <button onclick="openReminderModal('${student.id}')"
                    title="To'lov eslatmasi (Telegram / SMS)"
                    class="px-2 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition">
                    ✉️
                  </button>

                  <!-- Tahrirlash -->
                  <button onclick="openEditStudentModal('${student.id}')"
                    title="O'quvchini tahrirlash"
                    class="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>

                  <!-- O'chirish -->
                  <button onclick="deleteSingleStudent('${student.id}')"
                    title="O'quvchini o'chirish"
                    class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                `
                : `
                  <!-- MEHMON REJIMI: HECH NARSA O'ZGARTIRA OLMAYDI, FAQAT ESLATMA/TELEGRAM KO'RADI -->
                  <button onclick="openReminderModal('${student.id}')"
                    title="Telegram orqali eslatma"
                    class="px-2.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                    ✉️ Aloqa
                  </button>
                  <span class="text-[10px] text-slate-400 font-semibold px-1.5 py-1 bg-slate-100 rounded-md">
                    🔒 Faqat ko'rish
                  </span>
                `
            }
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// 9. Event Listeners
// ========================================================

function setupEventListeners() {
  const searchInput = document.getElementById('studentSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      renderStudentTable();
    });
  }

  const monthSelector = document.getElementById('monthSelector');
  if (monthSelector) {
    monthSelector.addEventListener('change', (e) => {
      switchMonth(e.target.value);
    });
  }

  const sortSelector = document.getElementById('sortSelector');
  if (sortSelector) {
    sortSelector.addEventListener('change', (e) => {
      state.filters.sortBy = e.target.value;
      renderStudentTable();
    });
  }
}

function setGroupFilter(group) {
  state.filters.group = group;
  renderGroupPills();
  renderStudentTable();
}

function setStatusFilter(status) {
  state.filters.status = status;

  const btnAll = document.getElementById('filterStatusAll');
  const btnPaid = document.getElementById('filterStatusPaid');
  const btnUnpaid = document.getElementById('filterStatusUnpaid');

  [btnAll, btnPaid, btnUnpaid].forEach(b => {
    if (!b) return;
    b.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition";
  });

  if (status === 'all' && btnAll) btnAll.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs transition";
  if (status === 'paid' && btnPaid) btnPaid.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs transition";
  if (status === 'unpaid' && btnUnpaid) btnUnpaid.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white shadow-xs transition";

  renderStudentTable();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.remove();
}

function safeSetText(elemId, text) {
  const elem = document.getElementById(elemId);
  if (elem) elem.textContent = text;
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  let bgClass = 'bg-slate-900 text-white';
  if (type === 'success') bgClass = 'bg-blue-600 text-white';
  else if (type === 'warning') bgClass = 'bg-slate-800 text-amber-300';
  else if (type === 'error') bgClass = 'bg-red-600 text-white';

  const toast = document.createElement('div');
  toast.className = `${bgClass} px-4 py-3 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 pointer-events-auto fade-in border border-white/10`;
  toast.innerHTML = `<span>${message}</span>`;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

document.addEventListener('DOMContentLoaded', initApp);
