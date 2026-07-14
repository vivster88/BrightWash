/* BrightWash Laundry Hub - Static POS Application */
'use strict';

// ===== CONFIGURATION & DEFAULTS =====
const CONFIG = {
  adminUser: 'admin',
  adminPass: 'Sh@rik@zuniga',
  defaultStaffUser: 'brightwashstaff',
  defaultStaffPass: 'brightwash',
  storageKeys: {
    auth: 'bw_auth',
    customers: 'bw_customers_v3',
    orders: 'bw_orders_v3',
    services: 'bw_services_v3',
    rewards: 'bw_rewards_v3',
    machines: 'bw_machines_v3',
    machineLogs: 'bw_machine_logs_v3',
    staff: 'bw_staff_v3',
    deletedLog: 'bw_deleted_v3',
    deleteRequests: 'bw_delete_requests_v1',
    shifts: 'bw_shifts_v1',
    activeShift: 'bw_active_shift',
    sheetsUrl: 'bw_sheets_url',
    lastSync: 'bw_last_sync',
  }
};

const DEFAULT_SERVICES = {
  WASH: { name: 'Wash', rate: 70, unit: 'load', icon: '🫧', duration: 38, staffCommission: 0 },
  DRY: { name: 'Dry', rate: 80, unit: 'load', icon: '🌬️', duration: 40, staffCommission: 0 },
  FOLD: { name: 'Fold', rate: 30, unit: 'load', icon: '👕', duration: 5, staffCommission: 15 },
  FULL_SERVICE: { name: 'Full Service (Wash+Dry+Fold)', rate: 180, unit: 'load', icon: '⭐', duration: 83, staffCommission: 15 },
  EXTRA_DRY: { name: 'Extra Dry', rate: 20, unit: 'load', icon: '⏱️', duration: 10, staffCommission: 0 },
  SPIN_DRY: { name: 'Spin Dry', rate: 15, unit: 'load', icon: '🔄', duration: 5, staffCommission: 0 },
};

const DEFAULT_REWARDS = { xpPerPhp: 0.5, pointsPerPhp: 0.05, pointsToPhpRate: 1, expressSurcharge: 100 };
const CLOTHING_ITEMS = ['Shirts', 'Pants', 'Dresses/Suits', 'Bedding/Linens', 'Coats/Heavy', 'Delicates'];
const CONSUMABLES = [
  { id: 'ariel_twin', name: 'Ariel (Twin Pack)', icon: '🧴', unit: 'pack', pricePerUnit: 17 },
  { id: 'tide', name: 'Tide (Single Pack)', icon: '🧴', unit: 'pack', pricePerUnit: 10 },
  { id: 'downy', name: 'Downy (Single Pack)', icon: '🌸', unit: 'pack', pricePerUnit: 12 },
  { id: 'zonrox', name: 'Zonrox Color Safe', icon: '🧪', unit: 'pack', pricePerUnit: 10 },
];
const PIE_COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b'];

function createMachine(id) {
  return {
    id, name: `BrightWash-M${id}`,
    wash: { status: 'IDLE', orderId: null, customer: null, start: null, duration: 30, end: null },
    dry: { status: 'IDLE', orderId: null, customer: null, start: null, duration: 40, end: null },
  };
}
const DEFAULT_MACHINES = [1,2,3,4,5,6,7,8,9,10].map(createMachine);

// ===== STATE MANAGEMENT =====
const State = {
  role: null, // 'admin' | 'staff'
  customers: [],
  orders: [],
  services: { ...DEFAULT_SERVICES },
  rewards: { ...DEFAULT_REWARDS },
  machines: [...DEFAULT_MACHINES],
  machineLogs: [],
  staff: [],
  deletedLog: [],
  deleteRequests: [],
  shifts: [],
  activeShift: null,
  selectedCustomerId: null,
  activeTab: 'pos',
  orderView: 'orders', // 'orders' | 'machines'
};

function loadState() {
  const auth = store.get(CONFIG.storageKeys.auth);
  if (auth) State.role = auth;
  // Load from localStorage as fallback (will be overwritten by DB sync)
  State.customers = store.get(CONFIG.storageKeys.customers) || [];
  State.orders = store.get(CONFIG.storageKeys.orders) || [];
  State.services = store.get(CONFIG.storageKeys.services) || { ...DEFAULT_SERVICES };
  State.rewards = store.get(CONFIG.storageKeys.rewards) || { ...DEFAULT_REWARDS };
  State.machines = store.get(CONFIG.storageKeys.machines) || DEFAULT_MACHINES.map(m => JSON.parse(JSON.stringify(m)));
  State.machineLogs = store.get(CONFIG.storageKeys.machineLogs) || [];
  State.staff = store.get(CONFIG.storageKeys.staff) || [];
  State.deletedLog = store.get(CONFIG.storageKeys.deletedLog) || [];
  State.deleteRequests = store.get(CONFIG.storageKeys.deleteRequests) || [];
  State.shifts = store.get(CONFIG.storageKeys.shifts) || [];
  State.activeShift = store.get(CONFIG.storageKeys.activeShift) || null;
  if (State.customers.length > 0) State.selectedCustomerId = State.customers[0].id;
}

// Sync from database (called after login and periodically)
async function syncFromDB() {
  try {
    const data = await DB.loadAll();
    if (data.customers && data.customers.length > 0) State.customers = data.customers;
    if (data.orders) State.orders = data.orders;
    if (data.services) State.services = data.services;
    if (data.machines && data.machines.length > 0) State.machines = data.machines;
    if (data.shifts) State.shifts = data.shifts;
    if (data.staff && data.staff.length > 0) State.staff = data.staff;
    if (data.deleteRequests) State.deleteRequests = data.deleteRequests;
    if (data.settings && data.settings.rewards) State.rewards = data.settings.rewards;
    if (State.customers.length > 0 && !State.selectedCustomerId) State.selectedCustomerId = State.customers[0].id;
    // Cache locally
    store.set(CONFIG.storageKeys.customers, State.customers);
    store.set(CONFIG.storageKeys.orders, State.orders);
    store.set(CONFIG.storageKeys.services, State.services);
    store.set(CONFIG.storageKeys.machines, State.machines);
    store.set(CONFIG.storageKeys.staff, State.staff);
    renderAll();
    return true;
  } catch (err) {
    console.error('[syncFromDB] Failed:', err);
    return false;
  }
}

function saveCustomers() { store.set(CONFIG.storageKeys.customers, State.customers); }
function saveOrders() { store.set(CONFIG.storageKeys.orders, State.orders); }
function saveServices() { store.set(CONFIG.storageKeys.services, State.services); }
function saveRewards() { store.set(CONFIG.storageKeys.rewards, State.rewards); DB.saveSetting('rewards', State.rewards); }
function saveMachines() { store.set(CONFIG.storageKeys.machines, State.machines); }
function saveMachineLogs() { store.set(CONFIG.storageKeys.machineLogs, State.machineLogs); }
function saveStaff() { store.set(CONFIG.storageKeys.staff, State.staff); }
function saveDeletedLog() { store.set(CONFIG.storageKeys.deletedLog, State.deletedLog); }
function saveDeleteRequests() { store.set(CONFIG.storageKeys.deleteRequests, State.deleteRequests); }
function saveShifts() { store.set(CONFIG.storageKeys.shifts, State.shifts); }
function saveActiveShift() { store.set(CONFIG.storageKeys.activeShift, State.activeShift); }

// ===== UTILITIES =====
const store = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del(key) { localStorage.removeItem(key); }
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg, type = 'success') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function genId() { return 'o' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4); }

function formatCurrency(n) { return '₱' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showModal(html) {
  $('#modal-content').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
}
function hideModal() { $('#modal-overlay').classList.add('hidden'); }

// ===== AUTHENTICATION =====
function handleLogin(e) {
  e.preventDefault();
  const user = $('#login-username').value.trim().toLowerCase();
  const pass = $('#login-password').value;
  const errEl = $('#login-error');

  // Use API for login (checks admin, default staff, and custom staff in DB)
  DB.login(user, pass).then(result => {
    if (result.success) {
      State.role = result.role;
      store.set(CONFIG.storageKeys.auth, State.role);
      errEl.classList.add('hidden');
      showApp();
    } else {
      errEl.textContent = result.error || 'Invalid username or password';
      errEl.classList.remove('hidden');
    }
  }).catch(() => {
    // Fallback to client-side check if API is down
    if (user === CONFIG.adminUser && pass === CONFIG.adminPass) {
      State.role = 'admin';
    } else if (user === CONFIG.defaultStaffUser && pass === CONFIG.defaultStaffPass) {
      State.role = 'staff';
    } else {
      const match = State.staff.find(s => s.username === user && s.password === pass);
      if (match) { State.role = 'staff'; }
      else { errEl.textContent = 'Invalid username or password'; errEl.classList.remove('hidden'); return; }
    }
    store.set(CONFIG.storageKeys.auth, State.role);
    errEl.classList.add('hidden');
    showApp();
  });
}

function handleLogout() {
  State.role = null;
  store.del(CONFIG.storageKeys.auth);
  $('#app').classList.add('hidden');
  $('#login-screen').classList.remove('hidden');
  $('#login-username').value = '';
  $('#login-password').value = '';
}

function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');

  const badge = $('#role-badge');
  badge.textContent = State.role === 'admin' ? 'Admin' : 'Staff';
  badge.className = `role-badge ${State.role}`;

  // Show/hide admin elements
  $$('.admin-only').forEach(el => {
    el.style.display = State.role === 'admin' ? '' : 'none';
  });

  // Default to POS tab for everyone
  switchTab('pos');
  
  renderAll();
  // Sync from database
  syncFromDB();
}

// ===== NAVIGATION =====
function switchTab(tab) {
  State.activeTab = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
  if (tab === 'reports') renderReports();
  if (tab === 'admin') renderAdmin();
}

// ===== METRICS =====
function renderMetrics() {
  const today = new Date().toISOString().split('T')[0];
  const todaysOrders = State.orders.filter(o => o.createdAt && o.createdAt.startsWith(today));
  const todayRev = todaysOrders.reduce((s, o) => s + o.totalCost, 0);
  const totalRev = State.orders.reduce((s, o) => s + o.totalCost, 0);
  const active = State.orders.filter(o => o.status === 'WASHING' || o.status === 'DRYING').length;

  $('#metric-today').textContent = formatCurrency(todayRev);
  $('#metric-cycles').textContent = active;
  $('#metric-customers').textContent = State.customers.length;
  $('#metric-total').textContent = formatCurrency(totalRev);
}

// ===== RENDER ALL =====
function renderAll() {
  renderMetrics();
  renderCustomers();
  renderOrderForm();
  renderOrdersPanel();
  renderShiftBar();
}

// ===== SHIFT SYSTEM =====
function renderShiftBar() {
  let shiftBar = document.getElementById('shift-bar');
  if (!shiftBar) {
    // Create shift bar element after metrics strip
    const metricsStrip = document.querySelector('.metrics-strip');
    if (!metricsStrip) return;
    shiftBar = document.createElement('div');
    shiftBar.id = 'shift-bar';
    shiftBar.style.cssText = 'padding:0 16px;margin-bottom:16px;';
    metricsStrip.after(shiftBar);
  }

  if (State.activeShift) {
    const elapsed = Math.round((Date.now() - new Date(State.activeShift.clockIn).getTime()) / 60000);
    const hours = Math.floor(elapsed / 60);
    const mins = elapsed % 60;
    shiftBar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-sm);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.2rem;">🟢</span>
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--emerald);">Shift Active — ${State.activeShift.staffName || 'Staff'}</div>
            <div style="font-size:0.62rem;color:var(--text-muted);">Started: ${new Date(State.activeShift.clockIn).toLocaleTimeString('en-PH', {hour:'2-digit',minute:'2-digit'})} • Duration: ${hours}h ${mins}m</div>
          </div>
        </div>
        <button class="btn-sm btn-danger" onclick="clockOut()" style="padding:8px 14px;">🕐 Clock Out & Generate Report</button>
      </div>`;
  } else {
    shiftBar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius-sm);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.2rem;">⏸️</span>
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--amber);">No Active Shift</div>
            <div style="font-size:0.62rem;color:var(--text-muted);">Clock in to start tracking your shift</div>
          </div>
        </div>
        <button class="btn-sm btn-success" onclick="clockIn()" style="padding:8px 14px;">▶️ Clock In</button>
      </div>`;
  }
}

function clockIn() {
  // Show cycle count input modal before starting shift
  let machineInputs = '';
  State.machines.forEach(m => {
    machineInputs += `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:0.72rem;font-weight:700;min-width:110px;">${m.name}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:0.6rem;color:var(--blue);">🫧 Wash:</label>
          <input type="number" min="0" value="0" data-machine="${m.id}" data-type="wash" style="width:60px;padding:6px;font-size:0.75rem;text-align:center;" class="cycle-input">
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:0.6rem;color:var(--purple);">🌬️ Dry:</label>
          <input type="number" min="0" value="0" data-machine="${m.id}" data-type="dry" style="width:60px;padding:6px;font-size:0.75rem;text-align:center;" class="cycle-input">
        </div>
      </div>`;
  });

  showModal(`
    <div>
      <h3 class="modal-title">⏱️ Clock In — Enter Machine Cycle Counts</h3>
      <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:14px;">Record the current cycle count for each machine before starting your shift.</p>
      <div style="max-height:300px;overflow-y:auto;">
        ${machineInputs}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
        <button class="btn-sm btn-primary" id="btn-confirm-clockin" style="padding:10px 20px;">▶️ Start Shift</button>
      </div>
    </div>
  `);

  document.getElementById('btn-confirm-clockin').addEventListener('click', () => {
    // Collect cycle counts
    const cycleCounts = {};
    document.querySelectorAll('.cycle-input').forEach(input => {
      const machineId = input.dataset.machine;
      const type = input.dataset.type;
      if (!cycleCounts[machineId]) cycleCounts[machineId] = {};
      cycleCounts[machineId][type] = parseInt(input.value) || 0;
    });

    const staffName = State.role === 'admin' ? 'Admin' : (CONFIG.defaultStaffUser);
    State.activeShift = {
      id: 'shift-' + Date.now(),
      staffName: staffName,
      role: State.role,
      clockIn: new Date().toISOString(),
      clockOut: null,
      ordersAtStart: State.orders.length,
      cycleCountStart: cycleCounts,
      cycleCountEnd: null,
    };
    saveActiveShift();
    hideModal();
    renderShiftBar();
    toast(`Shift started at ${new Date().toLocaleTimeString('en-PH', {hour:'2-digit',minute:'2-digit'})}`);
  });
}

function clockOut() {
  if (!State.activeShift) { toast('No active shift', 'error'); return; }

  // Show cycle count end modal
  let machineInputs = '';
  const startCounts = State.activeShift.cycleCountStart || {};
  State.machines.forEach(m => {
    const startW = startCounts[m.id]?.wash || 0;
    const startD = startCounts[m.id]?.dry || 0;
    machineInputs += `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:0.72rem;font-weight:700;min-width:110px;">${m.name}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:0.6rem;color:var(--blue);">🫧 Wash <span style="color:var(--text-muted);">(start: ${startW})</span>:</label>
          <input type="number" min="0" value="${startW}" data-machine="${m.id}" data-type="wash" style="width:60px;padding:6px;font-size:0.75rem;text-align:center;" class="cycle-end-input">
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <label style="font-size:0.6rem;color:var(--purple);">🌬️ Dry <span style="color:var(--text-muted);">(start: ${startD})</span>:</label>
          <input type="number" min="0" value="${startD}" data-machine="${m.id}" data-type="dry" style="width:60px;padding:6px;font-size:0.75rem;text-align:center;" class="cycle-end-input">
        </div>
      </div>`;
  });

  showModal(`
    <div>
      <h3 class="modal-title">🕐 Clock Out — Enter Ending Cycle Counts</h3>
      <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:14px;">Record the current cycle count for each machine at end of shift.</p>
      <div style="max-height:300px;overflow-y:auto;">
        ${machineInputs}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
        <button class="btn-sm btn-danger" id="btn-confirm-clockout" style="padding:10px 20px;">🕐 End Shift & Generate Report</button>
      </div>
    </div>
  `);

  document.getElementById('btn-confirm-clockout').addEventListener('click', () => {
    // Collect ending cycle counts
    const cycleCountEnd = {};
    document.querySelectorAll('.cycle-end-input').forEach(input => {
      const machineId = input.dataset.machine;
      const type = input.dataset.type;
      if (!cycleCountEnd[machineId]) cycleCountEnd[machineId] = {};
      cycleCountEnd[machineId][type] = parseInt(input.value) || 0;
    });

    hideModal();
    performClockOut(cycleCountEnd);
  });
}

function performClockOut(cycleCountEnd) {
  const shift = { ...State.activeShift };
  shift.clockOut = new Date().toISOString();
  shift.cycleCountEnd = cycleCountEnd;

  // Calculate shift stats
  const clockInTime = new Date(shift.clockIn).getTime();
  const clockOutTime = new Date(shift.clockOut).getTime();
  const durationMins = Math.round((clockOutTime - clockInTime) / 60000);
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;

  // Orders created during this shift
  const shiftOrders = State.orders.filter(o => {
    const t = new Date(o.createdAt).getTime();
    return t >= clockInTime && t <= clockOutTime;
  });
  const shiftRevenue = shiftOrders.reduce((sum, o) => sum + o.totalCost, 0);
  const completedOrders = shiftOrders.filter(o => o.status === 'COMPLETED').length;
  const pendingOrders = shiftOrders.filter(o => o.status !== 'COMPLETED').length;

  // Payment breakdown
  const paymentBreakdown = {};
  shiftOrders.forEach(o => {
    const p = o.payment || 'CASH';
    paymentBreakdown[p] = (paymentBreakdown[p] || 0) + o.totalCost;
  });

  // Commission breakdown
  const shiftCommission = shiftOrders.reduce((sum, o) => sum + (o.staffCommission || 0), 0);

  // Calculate cycle counts used during shift
  const cycleCountStart = shift.cycleCountStart || {};
  const cycleSummary = [];
  let totalCyclesUsed = 0;
  State.machines.forEach(m => {
    const startW = cycleCountStart[m.id]?.wash || 0;
    const startD = cycleCountStart[m.id]?.dry || 0;
    const endW = cycleCountEnd[m.id]?.wash || 0;
    const endD = cycleCountEnd[m.id]?.dry || 0;
    const usedW = Math.max(0, endW - startW);
    const usedD = Math.max(0, endD - startD);
    totalCyclesUsed += usedW + usedD;
    cycleSummary.push({ name: m.name, washStart: startW, washEnd: endW, washUsed: usedW, dryStart: startD, dryEnd: endD, dryUsed: usedD });
  });

  shift.stats = {
    totalOrders: shiftOrders.length,
    completedOrders,
    pendingOrders,
    revenue: shiftRevenue,
    staffCommission: shiftCommission,
    ownerNet: shiftRevenue - shiftCommission,
    durationMins,
    paymentBreakdown,
    cycleSummary,
    totalCyclesUsed,
  };

  // Save to shifts history
  State.shifts.unshift(shift);
  State.activeShift = null;
  saveShifts();
  saveActiveShift();
  renderShiftBar();

  // Show daily report modal
  let payBreakdownHtml = Object.entries(paymentBreakdown).map(([method, amount]) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${method}</span><span style="font-weight:700;">${formatCurrency(amount)}</span></div>`
  ).join('') || '<div style="color:var(--text-muted);font-size:0.7rem;">No transactions</div>';

  const reportHtml = `
    <div>
      <h3 class="modal-title">📊 Daily Shift Report</h3>
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:0.7rem;color:var(--text-muted);">Staff:</span>
          <span style="font-size:0.7rem;font-weight:700;">${shift.staffName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:0.7rem;color:var(--text-muted);">Clock In:</span>
          <span style="font-size:0.7rem;font-weight:600;">${new Date(shift.clockIn).toLocaleString('en-PH', {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'})}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:0.7rem;color:var(--text-muted);">Clock Out:</span>
          <span style="font-size:0.7rem;font-weight:600;">${new Date(shift.clockOut).toLocaleString('en-PH', {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'})}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);">
          <span style="font-size:0.7rem;color:var(--text-muted);">Duration:</span>
          <span style="font-size:0.7rem;font-weight:700;color:var(--teal);">${hours}h ${mins}m</span>
        </div>
      </div>
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px;">
        <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">Shift Summary</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:0.75rem;">Total Orders:</span><span style="font-size:0.75rem;font-weight:800;">${shift.stats.totalOrders}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:0.75rem;">Completed:</span><span style="font-size:0.75rem;font-weight:700;color:var(--emerald);">${completedOrders}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:0.75rem;">Pending/Active:</span><span style="font-size:0.75rem;font-weight:700;color:var(--amber);">${pendingOrders}</span></div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);"><span style="font-size:0.85rem;font-weight:700;">Total Revenue:</span><span style="font-size:1rem;font-weight:900;color:var(--emerald);">${formatCurrency(shiftRevenue)}</span></div>
        ${shiftCommission > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:6px;"><span style="font-size:0.75rem;color:var(--amber);">Staff Commission:</span><span style="font-size:0.75rem;font-weight:700;color:var(--amber);">₱${shiftCommission}</span></div><div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="font-size:0.75rem;color:var(--blue);">Owner Net:</span><span style="font-size:0.75rem;font-weight:700;color:var(--blue);">${formatCurrency(shiftRevenue - shiftCommission)}</span></div>` : ''}
      </div>
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px;">
        <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">Payment Breakdown</div>
        ${payBreakdownHtml}
      </div>
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px;">
        <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:10px;">Machine Cycle Counts (${totalCyclesUsed} total cycles)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:4px;font-size:0.6rem;font-weight:700;color:var(--text-muted);padding-bottom:4px;border-bottom:1px solid var(--border);">
          <span>Machine</span><span>W Start</span><span>W End</span><span>D Start</span><span>D End</span>
        </div>
        ${cycleSummary.map(c => `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:4px;font-size:0.65rem;padding:4px 0;border-bottom:1px solid var(--border);">
            <span style="font-weight:600;">${c.name.replace('BrightWash-','')}</span>
            <span>${c.washStart}</span>
            <span>${c.washEnd} <span style="color:var(--teal);">(+${c.washUsed})</span></span>
            <span>${c.dryStart}</span>
            <span>${c.dryEnd} <span style="color:var(--purple);">(+${c.dryUsed})</span></span>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Close</button>
        <button class="btn-sm btn-primary" onclick="printShiftReport('${shift.id}')" style="padding:10px 20px;">🖨️ Print Report</button>
      </div>
    </div>
  `;
  showModal(reportHtml);
  toast(`Shift ended. ${shift.stats.totalOrders} orders, ${formatCurrency(shiftRevenue)} earned.`);
}

function printShiftReport(shiftId) {
  const shift = State.shifts.find(s => s.id === shiftId) || State.shifts[0];
  if (!shift) return;
  const s = shift.stats;
  const clockIn = new Date(shift.clockIn).toLocaleString('en-PH');
  const clockOut = new Date(shift.clockOut).toLocaleString('en-PH');
  const hours = Math.floor(s.durationMins / 60);
  const mins = s.durationMins % 60;
  const payBreakdown = Object.entries(s.paymentBreakdown || {}).map(([m, a]) => `<div class="row"><span>${m}:</span><span>₱${a.toFixed(2)}</span></div>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Shift Report</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Courier New',monospace;padding:20px;max-width:300px;margin:0 auto;font-size:12px;}.center{text-align:center;}.bold{font-weight:bold;}.line{border-top:1px dashed #000;margin:8px 0;}.row{display:flex;justify-content:space-between;padding:2px 0;}h1{font-size:14px;margin-bottom:4px;}h2{font-size:10px;font-weight:normal;margin-bottom:8px;}</style></head><body>
<div class="center"><h1>BRIGHTWASH LAUNDRY HUB</h1><h2>Daily Shift Report</h2></div>
<div class="line"></div>
<div class="row"><span>Staff:</span><span class="bold">${shift.staffName}</span></div>
<div class="row"><span>Clock In:</span><span>${clockIn}</span></div>
<div class="row"><span>Clock Out:</span><span>${clockOut}</span></div>
<div class="row"><span>Duration:</span><span class="bold">${hours}h ${mins}m</span></div>
<div class="line"></div>
<div class="row"><span>Total Orders:</span><span class="bold">${s.totalOrders}</span></div>
<div class="row"><span>Completed:</span><span>${s.completedOrders}</span></div>
<div class="row"><span>Pending:</span><span>${s.pendingOrders}</span></div>
<div class="line"></div>
<div class="center bold" style="font-size:14px;padding:6px 0;">TOTAL: ₱${s.revenue.toFixed(2)}</div>
${s.staffCommission ? `<div class="row"><span>Staff Commission:</span><span>₱${s.staffCommission.toFixed(2)}</span></div><div class="row"><span>Owner Net:</span><span>₱${s.ownerNet.toFixed(2)}</span></div>` : ''}
<div class="line"></div>
${payBreakdown}
<div class="line"></div>
<div class="center bold" style="font-size:10px;margin-bottom:4px;">MACHINE CYCLE COUNTS (${s.totalCyclesUsed || 0} total)</div>
${(s.cycleSummary || []).map(c => `<div class="row"><span>${c.name.replace('BrightWash-','')}</span><span>W:${c.washStart}→${c.washEnd}(+${c.washUsed}) D:${c.dryStart}→${c.dryEnd}(+${c.dryUsed})</span></div>`).join('')}
<div class="line"></div>
<div class="center" style="font-size:10px;color:#666;margin-top:8px;">Generated: ${new Date().toLocaleString('en-PH')}</div>
<script>window.onload=function(){window.print();}</script></body></html>`;

  const w = window.open('', '_blank', 'width=350,height=600');
  if (w) { w.document.write(html); w.document.close(); }
  else { toast('Pop-up blocked', 'error'); }
}

// ===== CUSTOMERS =====
function renderCustomers(filter = '') {
  const list = $('#customer-list');
  const q = filter.toLowerCase();
  const filtered = q ? State.customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : State.customers;

  list.innerHTML = filtered.map(c => `
    <div class="customer-item ${c.id === State.selectedCustomerId ? 'selected' : ''}" data-id="${c.id}">
      <div>
        <div class="cust-name">${c.name}</div>
        <div class="cust-phone">${c.phone}</div>
      </div>
      <div class="cust-meta">
        <div class="cust-level">Lvl ${c.level}</div>
        <div class="cust-points">🪙 ${c.points}</div>
        ${State.role === 'admin' ? `<div style="display:flex;gap:3px;margin-top:4px;"><button class="btn-sm btn-accent" onclick="event.stopPropagation();editCustomer('${c.id}')" style="font-size:0.5rem;padding:2px 5px;">✏️</button><button class="btn-sm btn-danger" onclick="event.stopPropagation();deleteCustomer('${c.id}')" style="font-size:0.5rem;padding:2px 5px;">✕</button></div>` : ''}
      </div>
    </div>
  `).join('') || '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.75rem;">No customers found</div>';

  list.querySelectorAll('.customer-item').forEach(el => {
    el.addEventListener('click', () => {
      State.selectedCustomerId = el.dataset.id;
      renderCustomers(filter);
      renderOrderForm();
    });
  });
}

function editCustomer(custId) {
  const c = State.customers.find(x => x.id === custId);
  if (!c) return;
  showModal(`
    <div>
      <h3 class="modal-title">✏️ Edit Customer</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Name</label><input type="text" id="edit-cust-name" value="${c.name}" style="width:100%;"></div>
        <div><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Phone</label><input type="text" id="edit-cust-phone" value="${c.phone}" style="width:100%;"></div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Level</label><input type="number" id="edit-cust-level" value="${c.level}" style="width:100%;"></div>
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Points</label><input type="number" id="edit-cust-points" value="${c.points}" style="width:100%;"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
          <button class="btn-sm btn-primary" id="btn-save-edit-cust" style="padding:10px 20px;">Save</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('btn-save-edit-cust').addEventListener('click', () => {
    const name = document.getElementById('edit-cust-name').value.trim();
    const phone = document.getElementById('edit-cust-phone').value.trim();
    const level = parseInt(document.getElementById('edit-cust-level').value) || 1;
    const points = parseInt(document.getElementById('edit-cust-points').value) || 0;
    if (!name) { toast('Name required', 'error'); return; }
    const ci = State.customers.findIndex(x => x.id === custId);
    if (ci >= 0) {
      State.customers[ci] = { ...State.customers[ci], name, phone, level, points };
      saveCustomers();
      DB.updateCustomer(State.customers[ci]);
      hideModal();
      renderCustomers();
      toast(`Customer "${name}" updated`);
    }
  });
}

function deleteCustomer(custId) {
  if (State.role !== 'admin') { toast('Admin only', 'error'); return; }
  const c = State.customers.find(x => x.id === custId);
  if (!c) return;
  const hasOrders = State.orders.some(o => o.customerId === custId);
  const msg = hasOrders ? `"${c.name}" has existing orders. Delete anyway? Orders will keep the customer name.` : `Delete customer "${c.name}"?`;
  if (!confirm(msg)) return;
  State.customers = State.customers.filter(x => x.id !== custId);
  if (State.selectedCustomerId === custId) State.selectedCustomerId = State.customers[0]?.id || null;
  saveCustomers();
  DB.deleteCustomer(custId);
  renderCustomers();
  renderOrderForm();
  renderMetrics();
  toast(`Customer "${c.name}" deleted`);
}

function addCustomer() {
  const name = $('#new-cust-name').value.trim();
  const phone = $('#new-cust-phone').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }
  const cust = { id: 'c' + Date.now(), name, phone: phone || 'N/A', level: 1, xp: 0, points: 20, achievements: [], totalOrders: 0, joined: new Date().toISOString().split('T')[0] };
  State.customers.push(cust);
  State.selectedCustomerId = cust.id;
  saveCustomers();
  DB.saveCustomer(cust);
  $('#new-cust-name').value = '';
  $('#new-cust-phone').value = '';
  $('#add-customer-form').classList.add('hidden');
  renderCustomers();
  renderOrderForm();
  renderMetrics();
  toast(`Customer "${name}" added!`);
}

// ===== ORDER FORM =====
let orderState = { services: ['FULL_SERVICE'], weight: 8, items: {}, consumables: {}, express: false, usePoints: false, payment: 'CASH', paymentProof: null };

function renderOrderForm() {
  const cust = State.customers.find(c => c.id === State.selectedCustomerId);
  const container = $('#order-form-content');
  if (!cust) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.78rem;">Select a customer to start an order</div>';
    return;
  }

  const primaryService = orderState.services[0] || 'FULL_SERVICE';

  let html = `<div style="margin-bottom:14px;"><label style="font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Select Services (tap to add/remove)</label></div>`;
  html += `<div class="service-grid">`;
  Object.entries(State.services).forEach(([key, s]) => {
    const isSelected = orderState.services.includes(key);
    // Conflict: dim Fold if Full Service is selected, dim Full Service if Fold is selected
    const isConflict = (key === 'FOLD' && orderState.services.includes('FULL_SERVICE')) || (key === 'FULL_SERVICE' && orderState.services.includes('FOLD'));
    const conflictStyle = isConflict ? 'opacity:0.4;pointer-events:none;' : '';
    const conflictNote = isConflict ? '<div style="font-size:0.5rem;color:var(--red);margin-top:2px;">Conflicts with selection</div>' : '';
    html += `<div class="service-card ${isSelected ? 'selected' : ''}" data-service="${key}" style="${conflictStyle}">
      <div class="service-icon">${s.icon}</div>
      <div class="service-name">${s.name}</div>
      <div class="service-rate">₱${s.rate} / ${s.unit}${s.duration ? ' • ' + s.duration + 'min' : ''}</div>
      ${s.staffCommission ? `<div style="font-size:0.55rem;color:var(--amber);margin-top:2px;">👤 ₱${s.staffCommission} staff commission</div>` : ''}
      ${conflictNote}
      ${isSelected ? '<div style="position:absolute;top:6px;right:6px;font-size:0.7rem;">✓</div>' : ''}
    </div>`;
  });
  html += `</div>`;
  
  // Show selected services summary
  if (orderState.services.length > 1) {
    html += `<div style="margin-top:8px;padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-xs);border:1px solid var(--border);font-size:0.65rem;color:var(--teal);">Selected: ${orderState.services.map(k => State.services[k]?.name || k).join(' + ')}</div>`;
  }

  // Weight input
  html += `<div style="margin-top:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <label style="font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Weight (8kg max per load)</label>
      <span style="font-size:0.78rem;font-weight:800;color:var(--teal);">${orderState.weight.toFixed(1)} kg</span>
    </div>
    <div class="weight-control">
      <button class="weight-btn" data-action="dec">−</button>
      <input type="range" min="0.5" max="8" step="0.5" value="${orderState.weight}" id="weight-slider">
      <button class="weight-btn" data-action="inc">+</button>
      <span class="weight-value">${orderState.weight.toFixed(1)} kg</span>
    </div>
    ${orderState.weight > 8 ? '<div style="font-size:0.62rem;color:var(--red);margin-top:4px;">⚠️ Over 8kg — will count as additional load</div>' : ''}
    <div style="font-size:0.6rem;color:var(--text-muted);margin-top:4px;">Loads: ${Math.ceil(orderState.weight / 8)} (8kg max per load)</div>
  </div>`;

  // Consumables / Supplies
  const suggestedQty = Math.ceil(orderState.weight / 3); // 1 unit per ~3kg
  html += `<div style="margin-top:16px;">
    <label style="font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:block;">Supplies / Consumables</label>
    <div style="font-size:0.6rem;color:var(--text-muted);margin-bottom:8px;">Suggested: ${suggestedQty} unit(s) per item based on ${orderState.weight.toFixed(1)}kg load</div>
    <div class="items-list">`;
  CONSUMABLES.forEach(c => {
    const qty = orderState.consumables[c.id] || 0;
    html += `<div class="item-row">
      <span class="item-name">${c.icon} ${c.name} <span style="font-size:0.58rem;color:var(--text-muted);">₱${c.pricePerUnit}/${c.unit}</span></span>
      <div class="item-controls">
        <button class="weight-btn" data-cons="${c.id}" data-action="sub">−</button>
        <span class="item-qty">${qty}</span>
        <button class="weight-btn" data-cons="${c.id}" data-action="add">+</button>
      </div>
    </div>`;
  });
  html += `</div></div>`;

  // Addons
  html += `<div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
    <label style="font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Options</label>
    <div class="addon-row ${orderState.usePoints ? 'active' : ''}" id="addon-points">
      <div><div class="addon-label">🪙 Redeem Points</div><div class="addon-desc">Available: ${cust.points} pts (save ₱${cust.points * State.rewards.pointsToPhpRate})</div></div>
      <input type="checkbox" ${orderState.usePoints ? 'checked' : ''} ${cust.points === 0 ? 'disabled' : ''} style="width:16px;height:16px;accent-color:var(--teal);">
    </div>
  </div>`;

  // Payment method
  html += `<div style="margin-top:16px;"><label style="font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;display:block;">Payment</label><div class="payment-grid" style="grid-template-columns:1fr 1fr 1fr 1fr;">
    <button class="payment-btn ${orderState.payment === 'CASH' ? 'selected' : ''}" data-pay="CASH">💵 Cash</button>
    <button class="payment-btn ${orderState.payment === 'GCASH' ? 'selected' : ''}" data-pay="GCASH" style="${orderState.payment === 'GCASH' ? 'background:rgba(0,112,255,0.15);border-color:rgba(0,112,255,0.4);' : ''}"><span style="color:#0070FF;font-weight:800;font-size:0.72rem;">GCash</span></button>
    <button class="payment-btn ${orderState.payment === 'MAYA' ? 'selected' : ''}" data-pay="MAYA" style="${orderState.payment === 'MAYA' ? 'background:rgba(0,208,145,0.12);border-color:rgba(0,208,145,0.4);' : ''}"><span style="color:#00D091;font-weight:800;font-size:0.72rem;">maya</span></button>
    <button class="payment-btn ${orderState.payment === 'QR' ? 'selected' : ''}" data-pay="QR" style="${orderState.payment === 'QR' ? 'background:rgba(206,17,38,0.1);border-color:rgba(206,17,38,0.3);' : ''}"><span style="font-weight:800;font-size:0.68rem;"><span style="color:#CE1126;">QR</span><span style="color:#0038A8;"> Ph</span></span></button>
  </div></div>`;

  // Checkout
  const total = calcTotal(cust);
  const loads = Math.ceil(orderState.weight / 8);
  html += `<div class="checkout-box" style="margin-top:16px;">
    ${orderState.services.map(k => { const s = State.services[k]; return s ? `<div class="checkout-row"><span>${s.icon} ${s.name}${loads > 1 ? ' × ' + loads : ''}:</span><span>₱${s.rate * loads}</span></div>` : ''; }).join('')}
    ${CONSUMABLES.filter(c => (orderState.consumables[c.id] || 0) > 0).map(c => `<div class="checkout-row" style="color:var(--purple)"><span>${c.icon} ${c.name} x${orderState.consumables[c.id]}:</span><span>+₱${orderState.consumables[c.id] * c.pricePerUnit}</span></div>`).join('')}
    ${orderState.usePoints && cust.points > 0 ? `<div class="checkout-row" style="color:var(--teal)"><span>Points discount:</span><span>-₱${Math.min(total, cust.points * State.rewards.pointsToPhpRate)}</span></div>` : ''}
    <div class="checkout-total"><span class="total-label">Total</span><span class="total-value">${formatCurrency(total)}</span></div>
    ${(() => { let comm = 0; orderState.services.forEach(k => { const s = State.services[k]; if (s && s.staffCommission) comm += s.staffCommission * loads; }); return comm > 0 ? `<div class="checkout-row" style="color:var(--amber);margin-top:6px;"><span>👤 Staff commission:</span><span>₱${comm}</span></div>` : ''; })()}
    <button class="btn-primary" style="width:100%;margin-top:14px;" id="btn-checkout">✨ SUBMIT ORDER</button>
  </div>`;

  container.innerHTML = html;
  bindOrderForm(cust);
}

function calcTotal(cust) {
  let cost = 0;
  const loads = Math.ceil(orderState.weight / 8); // 8kg max per load
  orderState.services.forEach(key => {
    const svc = State.services[key];
    if (!svc) return;
    cost += loads * svc.rate;
  });
  // Add consumables cost
  CONSUMABLES.forEach(c => {
    const qty = orderState.consumables[c.id] || 0;
    cost += qty * c.pricePerUnit;
  });
  if (orderState.usePoints && cust) {
    const discount = Math.min(cost, cust.points * State.rewards.pointsToPhpRate);
    cost -= discount;
  }
  return Math.max(0, parseFloat(cost.toFixed(2)));
}

function bindOrderForm(cust) {
  // Service selection (multi-select with conflict rules)
  document.querySelectorAll('.service-card').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.service;
      const idx = orderState.services.indexOf(key);
      if (idx >= 0) {
        // Don't remove if it's the only one
        if (orderState.services.length > 1) orderState.services.splice(idx, 1);
      } else {
        // Conflict rules: Fold and Full Service are mutually exclusive
        if (key === 'FULL_SERVICE') {
          // Remove Fold if selecting Full Service (Full Service includes Fold)
          orderState.services = orderState.services.filter(s => s !== 'FOLD');
          orderState.services.push(key);
        } else if (key === 'FOLD') {
          // Remove Full Service if selecting Fold separately
          orderState.services = orderState.services.filter(s => s !== 'FULL_SERVICE');
          orderState.services.push(key);
        } else {
          orderState.services.push(key);
        }
      }
      orderState.items = {};
      renderOrderForm();
    });
  });

  // Weight controls
  const slider = document.getElementById('weight-slider');
  if (slider) {
    slider.addEventListener('input', (e) => { orderState.weight = parseFloat(e.target.value); renderOrderForm(); });
  }
  document.querySelectorAll('.weight-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'inc') orderState.weight = Math.min(25, orderState.weight + 0.5);
      if (btn.dataset.action === 'dec') orderState.weight = Math.max(0.5, orderState.weight - 0.5);
      renderOrderForm();
    });
  });

  // Consumables controls
  document.querySelectorAll('.weight-btn[data-cons]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cons;
      if (!orderState.consumables[id]) orderState.consumables[id] = 0;
      if (btn.dataset.action === 'add') orderState.consumables[id]++;
      if (btn.dataset.action === 'sub') orderState.consumables[id] = Math.max(0, orderState.consumables[id] - 1);
      renderOrderForm();
    });
  });

  // Addons
  const pointsEl = document.getElementById('addon-points');
  if (pointsEl) pointsEl.addEventListener('click', () => { if (cust.points > 0) { orderState.usePoints = !orderState.usePoints; renderOrderForm(); } });

  // Payment
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', () => { orderState.payment = btn.dataset.pay; orderState.paymentProof = null; renderOrderForm(); });
  });

  // Checkout
  const checkoutBtn = document.getElementById('btn-checkout');
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => processCheckout(cust));
}

// ===== CHECKOUT =====
function processCheckout(cust) {
  const totalCost = calcTotal(cust);
  const primaryService = orderState.services[0] || 'FULL_SERVICE';
  const xpEarned = Math.round(totalCost * State.rewards.xpPerPhp);
  const pointsEarned = Math.round(totalCost * State.rewards.pointsPerPhp);

  // For digital payments, check if proof is needed
  const isDigitalPayment = ['GCASH', 'MAYA', 'QR'].includes(orderState.payment);
  if (isDigitalPayment && !orderState.paymentProof) {
    showPaymentProofModal(cust, totalCost);
    return;
  }

  // Calculate staff commission
  const loads = Math.ceil(orderState.weight / 8);
  let staffCommission = 0;
  orderState.services.forEach(key => {
    const svc = State.services[key];
    if (svc && svc.staffCommission) staffCommission += svc.staffCommission * loads;
  });

  const order = {
    id: genId(),
    customerId: cust.id,
    customerName: cust.name,
    serviceType: primaryService,
    selectedServices: [...orderState.services],
    items: [],
    consumables: CONSUMABLES.filter(c => (orderState.consumables[c.id] || 0) > 0).map(c => ({ id: c.id, name: c.name, qty: orderState.consumables[c.id], unitPrice: c.pricePerUnit })),
    weightKg: orderState.weight,
    isExpress: orderState.express,
    totalCost,
    staffCommission,
    xpEarned,
    pointsEarned,
    status: 'PENDING',
    payment: orderState.payment,
    paymentProof: orderState.paymentProof || null,
    createdAt: new Date().toISOString(),
    // Transition timestamps
    transitions: [{ from: null, to: 'PENDING', at: new Date().toISOString() }],
  };

  State.orders.unshift(order);

  // Update customer loyalty
  const ci = State.customers.findIndex(c => c.id === cust.id);
  if (ci >= 0) {
    const c = State.customers[ci];
    let newXp = c.xp + xpEarned;
    let newPoints = c.points + pointsEarned;
    if (orderState.usePoints) {
      const discount = Math.min(totalCost + (cust.points * State.rewards.pointsToPhpRate), cust.points * State.rewards.pointsToPhpRate);
      const redeemed = Math.round(discount / State.rewards.pointsToPhpRate);
      newPoints = Math.max(0, c.points - redeemed) + pointsEarned;
    }
    let newLevel = c.level;
    const threshold = c.level * 100;
    if (newXp >= threshold) { newLevel++; newXp -= threshold; toast(`🎉 ${c.name} leveled up to Level ${newLevel}!`, 'info'); }
    State.customers[ci] = { ...c, xp: newXp, points: newPoints, level: newLevel, totalOrders: c.totalOrders + 1 };
  }

  saveOrders();
  saveCustomers();
  // Sync to database
  DB.saveOrder(order);
  DB.updateCustomer(State.customers[ci]);

  // Reset order form
  orderState = { services: ['FULL_SERVICE'], weight: 8, items: {}, consumables: {}, express: false, usePoints: false, payment: 'CASH', paymentProof: null };
  renderAll();
  toast(`Order ${order.id} created for ${cust.name}!`);
}

// ===== PAYMENT PROOF MODAL =====
function showPaymentProofModal(cust, totalCost) {
  const html = `
    <div style="text-align:center;">
      <h3 class="modal-title">📱 Attach Payment Proof</h3>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:16px;">
        Payment: <strong style="color:var(--teal)">${orderState.payment}</strong> — ${formatCurrency(totalCost)}
      </p>
      <div id="proof-preview" style="width:100%;min-height:120px;border:2px dashed var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;overflow:hidden;cursor:pointer;position:relative;" onclick="document.getElementById('proof-input').click()">
        <span id="proof-placeholder" style="font-size:0.75rem;color:var(--text-muted);padding:20px;text-align:center;">
          📷 Tap to upload screenshot / photo<br><span style="font-size:0.65rem;">Supports JPG, PNG (max 2MB)</span>
        </span>
      </div>
      <input type="file" id="proof-input" accept="image/*" capture="environment" style="display:none;">
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn-sm btn-ghost" id="btn-proof-skip" style="padding:10px 20px;">Skip (No Proof)</button>
        <button class="btn-sm btn-primary" id="btn-proof-submit" style="padding:10px 20px;" disabled>Submit with Proof</button>
      </div>
    </div>
  `;
  showModal(html);

  const input = document.getElementById('proof-input');
  const preview = document.getElementById('proof-preview');
  const placeholder = document.getElementById('proof-placeholder');
  const submitBtn = document.getElementById('btn-proof-submit');

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Image too large (max 2MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      orderState.paymentProof = ev.target.result;
      placeholder.style.display = 'none';
      preview.innerHTML = '<img src="' + ev.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;">';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-proof-skip').addEventListener('click', () => {
    orderState.paymentProof = null;
    hideModal();
    processCheckout(cust);
  });

  submitBtn.addEventListener('click', () => {
    hideModal();
    processCheckout(cust);
  });
}

// ===== ORDERS & MACHINES PANEL =====
function renderOrdersPanel() {
  const container = $('#orders-machines-content');
  if (State.orderView === 'orders') {
    renderOrdersList(container);
  } else {
    renderMachinesView(container);
  }
}

function renderOrdersList(container) {
  const activeOrders = State.orders.filter(o => o.status !== 'COMPLETED');
  const completedOrders = State.orders.filter(o => o.status === 'COMPLETED').slice(0, 10);

  let html = '<div class="orders-list">';
  if (activeOrders.length === 0 && completedOrders.length === 0) {
    html += '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.75rem;">No orders yet. Create one from the order form.</div>';
  }

  activeOrders.forEach(o => { html += orderCardHtml(o); });
  if (completedOrders.length > 0) {
    html += `<div style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px;padding:8px 0;margin-top:8px;border-top:1px solid var(--border);">Recent Completed</div>`;
    completedOrders.forEach(o => { html += orderCardHtml(o); });
  }
  html += '</div>';
  container.innerHTML = html;

  // Bind order actions
  container.querySelectorAll('.order-card').forEach(card => {
    const advBtn = card.querySelector('.btn-advance');
    if (advBtn) advBtn.addEventListener('click', (e) => { e.stopPropagation(); advanceOrder(advBtn.dataset.id); });
    const delBtn = card.querySelector('.btn-del-order');
    if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteOrder(delBtn.dataset.id); });
  });
}

function orderCardHtml(o) {
  const canAdvance = o.status !== 'COMPLETED';
  const nextLabel = { PENDING: 'Start Wash', WASHING: 'Move to Dry', DRYING: 'Mark Ready', READY: 'Complete' }[o.status] || '';
  // Calculate time in current status
  let timeInStatus = '';
  if (o.transitions && o.transitions.length > 0) {
    const last = o.transitions[o.transitions.length - 1];
    const elapsed = Math.round((Date.now() - new Date(last.at).getTime()) / 60000);
    if (o.status !== 'COMPLETED') timeInStatus = `${elapsed}m in ${o.status}`;
  }
  const hasProof = o.paymentProof ? '<span style="font-size:0.6rem;color:var(--teal);cursor:pointer;" onclick="viewPaymentProof(\'' + o.id + '\')">📷 Proof</span>' : '';
  const payLabel = o.payment && o.payment !== 'CASH' ? `<span style="font-size:0.58rem;color:var(--purple);margin-left:4px;">${o.payment}</span>` : '';
  const hasPendingDelete = State.deleteRequests.find(r => r.orderId === o.id && r.status === 'pending');
  const pendingBadge = hasPendingDelete ? '<span style="font-size:0.55rem;background:rgba(245,158,11,0.15);color:var(--amber);padding:2px 6px;border-radius:8px;font-weight:700;">⏳ DELETE REQUESTED</span>' : '';

  return `<div class="order-card">
    <div class="order-info">
      <span class="order-id">${o.id}${payLabel}</span>
      <span class="order-customer">${o.customerName}</span>
      <span class="order-service">${o.selectedServices ? o.selectedServices.map(k => State.services[k]?.name || k).join(' + ') : (State.services[o.serviceType]?.name || o.serviceType)} • ${o.weightKg.toFixed(1)}kg</span>
      ${timeInStatus ? `<span style="font-size:0.6rem;color:var(--amber);margin-top:2px;">⏱️ ${timeInStatus}</span>` : ''}
      ${pendingBadge}
    </div>
    <div class="order-right">
      <span class="order-amount">${formatCurrency(o.totalCost)}</span>
      <span class="status-badge ${o.status.toLowerCase()}">${o.status}</span>
      ${hasProof}
      <div style="display:flex;gap:4px;margin-top:4px;">
        ${canAdvance ? `<button class="btn-sm btn-success btn-advance" data-id="${o.id}">${nextLabel}</button>` : ''}
        <button class="btn-sm btn-ghost" style="font-size:0.55rem;padding:3px 6px;" onclick="printReceipt('${o.id}')">🖨️</button>
        <button class="btn-sm btn-danger btn-del-order" data-id="${o.id}">✕</button>
      </div>
    </div>
  </div>`;
}

// View payment proof image
function viewPaymentProof(orderId) {
  const order = State.orders.find(o => o.id === orderId);
  if (!order || !order.paymentProof) { toast('No payment proof attached', 'error'); return; }
  const deleteBtn = State.role === 'admin' ? `<button class="btn-sm btn-danger" onclick="deletePaymentProof('${order.id}')" style="padding:10px 24px;">🗑️ Delete Proof</button>` : '';
  const html = `
    <div style="text-align:center;">
      <h3 class="modal-title">📷 Payment Proof — ${order.payment}</h3>
      <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:12px;">Order: ${order.id} • ${order.customerName} • ${formatCurrency(order.totalCost)}</p>
      <p style="font-size:0.65rem;color:var(--text-muted);margin-bottom:8px;">${formatDate(order.createdAt)}</p>
      <img src="${order.paymentProof}" style="max-width:100%;max-height:400px;border-radius:12px;border:1px solid var(--border);">
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 24px;">Close</button>
        ${deleteBtn}
      </div>
    </div>
  `;
  showModal(html);
}

// Admin: delete payment proof after validation
function deletePaymentProof(orderId) {
  if (State.role !== 'admin') { toast('Admin only', 'error'); return; }
  const order = State.orders.find(o => o.id === orderId);
  if (!order) return;

  // Show a clear warning modal
  showModal(`
    <div style="text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:12px;">⚠️</div>
      <h3 class="modal-title" style="color:var(--red);">Permanently Delete Payment Proof?</h3>
      <div style="padding:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);margin:16px 0;text-align:left;">
        <p style="font-size:0.75rem;color:var(--text-primary);margin-bottom:8px;font-weight:600;">This action will:</p>
        <ul style="font-size:0.7rem;color:var(--text-secondary);list-style:disc;padding-left:18px;line-height:1.8;">
          <li>Permanently delete the proof of payment image</li>
          <li><strong style="color:var(--red);">Will NOT reflect on your Google Sheet</strong> — the sheet will still show the old proof link</li>
          <li>Cannot be recovered once deleted</li>
        </ul>
      </div>
      <p style="font-size:0.68rem;color:var(--text-muted);margin-bottom:16px;">Order: <strong>${order.id}</strong> • ${order.customerName} • ${formatCurrency(order.totalCost)} • ${order.payment}</p>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 24px;">Cancel</button>
        <button class="btn-sm btn-danger" id="btn-confirm-delete-proof" style="padding:10px 24px;">🗑️ Delete Permanently</button>
      </div>
    </div>
  `);

  document.getElementById('btn-confirm-delete-proof').addEventListener('click', () => {
    const oi = State.orders.findIndex(o => o.id === orderId);
    if (oi >= 0) {
      State.orders[oi].paymentProof = null;
      State.orders[oi].proofDeleted = true;
      State.orders[oi].proofDeletedAt = new Date().toISOString();
      State.orders[oi].proofDeletedBy = 'admin';
      saveOrders();
      hideModal();
      renderAll();
      toast('Payment proof permanently deleted');
    }
  });
}

// ===== PRINT RECEIPT =====
function printReceipt(orderId) {
  const order = State.orders.find(o => o.id === orderId);
  if (!order) { toast('Order not found', 'error'); return; }
  const date = new Date(order.createdAt).toLocaleString('en-PH');
  const loads = Math.ceil(order.weightKg / 8) || 1;

  // Build services breakdown
  const services = (order.selectedServices || [order.serviceType]).map(key => {
    const s = State.services[key];
    if (!s) return null;
    return { name: s.name, rate: s.rate, loads, subtotal: s.rate * loads };
  }).filter(Boolean);
  const servicesTotal = services.reduce((sum, s) => sum + s.subtotal, 0);

  // Build consumables breakdown
  const consumables = (order.consumables || []).map(c => ({
    name: c.name, qty: c.qty, unitPrice: c.unitPrice, subtotal: c.qty * c.unitPrice
  }));
  const consumablesTotal = consumables.reduce((sum, c) => sum + c.subtotal, 0);

  // Services rows HTML
  const svcRows = services.map(s =>
    `<div class="row"><span>${s.name} ${loads > 1 ? 'x' + loads + ' loads' : '(1 load)'}</span><span>₱${s.subtotal.toFixed(2)}</span></div>`
  ).join('');

  // Consumables rows HTML
  const consRows = consumables.length > 0 ? consumables.map(c =>
    `<div class="row"><span>${c.name} x${c.qty}</span><span>₱${c.subtotal.toFixed(2)}</span></div>`
  ).join('') : '';

  const receiptHtml = `<!DOCTYPE html><html><head><title>Receipt - ${order.id}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; font-size: 11px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .section-label { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 6px 0 4px; }
  h1 { font-size: 14px; margin-bottom: 2px; }
  h2 { font-size: 10px; font-weight: normal; margin-bottom: 8px; }
  .footer { margin-top: 12px; font-size: 9px; color: #666; }
</style></head><body>
<div class="center">
  <h1>BRIGHTWASH LAUNDRY HUB</h1>
  <h2>Clean • Fresh • Affordable</h2>
</div>
<div class="line"></div>
<div class="row"><span>Receipt #:</span><span class="bold">${order.id}</span></div>
<div class="row"><span>Date:</span><span>${date}</span></div>
<div class="row"><span>Customer:</span><span class="bold">${order.customerName}</span></div>
<div class="row"><span>Weight:</span><span>${order.weightKg.toFixed(1)} kg (${loads} load${loads > 1 ? 's' : ''})</span></div>
<div class="row"><span>Payment:</span><span>${order.payment || 'CASH'}</span></div>
<div class="line"></div>

<div class="section-label">Services</div>
${svcRows}
${services.length > 1 ? `<div class="row bold"><span>Services subtotal:</span><span>₱${servicesTotal.toFixed(2)}</span></div>` : ''}

${consumables.length > 0 ? `
<div class="line"></div>
<div class="section-label">Extras / Supplies</div>
${consRows}
<div class="row bold"><span>Extras subtotal:</span><span>₱${consumablesTotal.toFixed(2)}</span></div>
` : ''}

<div class="line"></div>
<div class="row bold" style="font-size:14px;padding:8px 0;">
  <span>TOTAL:</span>
  <span>₱${order.totalCost.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
</div>
<div class="line"></div>

${order.staffCommission ? `<div class="row" style="font-size:10px;color:#666;"><span>Staff commission:</span><span>₱${order.staffCommission.toFixed(2)}</span></div>` : ''}
<div class="row"><span>Status:</span><span>${order.status}</span></div>
${order.washMachine ? '<div class="row"><span>Washer:</span><span>' + order.washMachine + '</span></div>' : ''}
${order.dryMachine ? '<div class="row"><span>Dryer:</span><span>' + order.dryMachine + '</span></div>' : ''}
${order.xpEarned ? '<div class="row"><span>XP Earned:</span><span>+' + order.xpEarned + '</span></div>' : ''}
${order.pointsEarned ? '<div class="row"><span>Points Earned:</span><span>+' + order.pointsEarned + '</span></div>' : ''}

<div class="line"></div>
<div class="center footer">
  <p style="margin-bottom:4px;">Thank you for choosing BrightWash!</p>
  <p>Please remove valuables & empty pockets.</p>
  <p style="margin-top:6px;">★ Clean • Fresh • Affordable ★</p>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const printWindow = window.open('', '_blank', 'width=350,height=700');
  if (printWindow) {
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  } else {
    toast('Pop-up blocked. Please allow pop-ups.', 'error');
  }
}

function advanceOrder(orderId) {
  const oi = State.orders.findIndex(o => o.id === orderId);
  if (oi < 0) return;
  const order = State.orders[oi];
  const now = new Date().toISOString();
  if (!order.transitions) order.transitions = [];

  const prevStatus = order.status;

  if (order.status === 'PENDING') {
    // Show machine selection for washer
    const availableWash = State.machines.filter(m => m.wash.status === 'IDLE' && !m.maintenance);
    if (availableWash.length === 0) { toast('No washing machines available!', 'error'); return; }
    showMachinePickerModal(orderId, 'wash', availableWash, order);
    return;
  } else if (order.status === 'WASHING') {
    // Unload washer, show machine selection for dryer
    const washM = State.machines.find(m => m.wash.orderId === orderId);
    if (washM) washM.wash = { status: 'IDLE', orderId: null, customer: null, start: null, duration: 30, end: null };
    const availableDry = State.machines.filter(m => m.dry.status === 'IDLE' && !m.maintenance);
    if (availableDry.length === 0) { toast('No dryers available!', 'error'); saveMachines(); return; }
    showMachinePickerModal(orderId, 'dry', availableDry, order);
    return;
  } else if (order.status === 'DRYING') {
    const dryM = State.machines.find(m => m.dry.orderId === orderId);
    if (dryM) dryM.dry = { status: 'IDLE', orderId: null, customer: null, start: null, duration: 40, end: null };
    order.status = 'READY';
    order.readyAt = now;
  } else if (order.status === 'READY') {
    order.status = 'COMPLETED';
    order.completedAt = now;
  }

  // Record transition with duration
  const lastTransition = order.transitions[order.transitions.length - 1];
  const durationMs = lastTransition ? new Date(now).getTime() - new Date(lastTransition.at).getTime() : 0;
  const durationMins = Math.round(durationMs / 60000);
  order.transitions.push({ from: prevStatus, to: order.status, at: now, durationMins });

  State.orders[oi] = order;
  saveOrders();
  saveMachines();
  // Sync to DB
  DB.updateOrder(order);
  State.machines.forEach(m => DB.updateMachine(m));
  renderAll();
  toast(`Order ${orderId} → ${order.status} (${durationMins} min in ${prevStatus})`);
}

// Machine picker modal
function showMachinePickerModal(orderId, type, availableMachines, order) {
  const typeLabel = type === 'wash' ? '🫧 Washer' : '🌬️ Dryer';
  let machineOptions = availableMachines.map(m => `
    <button class="btn-sm btn-accent machine-pick-btn" data-pick-machine="${m.id}" style="padding:12px 16px;font-size:0.78rem;width:100%;text-align:left;margin-bottom:6px;">
      ${m.name} — ${typeLabel} Available
    </button>
  `).join('');

  showModal(`
    <div>
      <h3 class="modal-title">Select ${typeLabel} for Order</h3>
      <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:14px;">Customer: <strong>${order.customerName}</strong> • ${formatCurrency(order.totalCost)}</p>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${machineOptions}
      </div>
      <div style="margin-top:14px;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
      </div>
    </div>
  `);

  document.querySelectorAll('.machine-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const machineId = parseInt(btn.dataset.pickMachine);
      hideModal();
      assignMachineToOrder(orderId, type, machineId);
    });
  });
}

// Assign picked machine to order
function assignMachineToOrder(orderId, type, machineId) {
  const oi = State.orders.findIndex(o => o.id === orderId);
  if (oi < 0) return;
  const order = State.orders[oi];
  const mi = State.machines.findIndex(m => m.id === machineId);
  if (mi < 0) return;
  const machine = State.machines[mi];
  const now = new Date().toISOString();
  if (!order.transitions) order.transitions = [];
  const prevStatus = order.status;

  if (type === 'wash') {
    machine.wash = { status: 'RUNNING', orderId, customer: order.customerName, start: now, duration: 38, end: new Date(Date.now() + 38*60*1000).toISOString() };
    order.status = 'WASHING';
    order.washMachine = machine.name;
    order.washStart = now;
  } else {
    machine.dry = { status: 'RUNNING', orderId, customer: order.customerName, start: now, duration: 40, end: new Date(Date.now() + 40*60*1000).toISOString() };
    order.status = 'DRYING';
    order.dryMachine = machine.name;
    order.dryStart = now;
  }

  // Record transition
  const lastTransition = order.transitions[order.transitions.length - 1];
  const durationMs = lastTransition ? new Date(now).getTime() - new Date(lastTransition.at).getTime() : 0;
  const durationMins = Math.round(durationMs / 60000);
  order.transitions.push({ from: prevStatus, to: order.status, at: now, durationMins });

  State.orders[oi] = order;
  State.machines[mi] = machine;
  saveOrders(); saveMachines();
  DB.updateOrder(order);
  DB.updateMachine(machine);
  renderAll();
  toast(`Order ${orderId} → ${order.status} on ${machine.name}`);
}

function deleteOrder(orderId) {
  const oi = State.orders.findIndex(o => o.id === orderId);
  if (oi < 0) return;
  const order = State.orders[oi];

  // Check if already has pending request
  if (State.deleteRequests.find(r => r.orderId === orderId && r.status === 'pending')) {
    toast('Deletion already requested for this order', 'info');
    return;
  }

  if (State.role === 'admin') {
    // Admin can delete directly with simple confirm
    if (!confirm(`[Admin] Delete order ${orderId} for ${order.customerName}?`)) return;
    performDeleteOrder(oi, order, 'Admin direct deletion');
  } else {
    // Staff can only REQUEST deletion — must provide reason
    showModal(`
      <div>
        <h3 class="modal-title">📋 Request Order Deletion</h3>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">Order: <strong style="color:var(--blue);">${orderId}</strong></p>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:16px;">Customer: <strong>${order.customerName}</strong> • ${formatCurrency(order.totalCost)}</p>
        <p style="font-size:0.7rem;color:var(--amber);margin-bottom:12px;">⚠️ Only Admin can approve deletion. Your request will be reviewed.</p>
        <label style="font-size:0.68rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:6px;">Reason for deletion (required)</label>
        <textarea id="delete-reason" rows="3" placeholder="Why should this order be deleted?" style="width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;font-size:0.8rem;color:var(--text-primary);resize:vertical;font-family:var(--font);outline:none;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
          <button class="btn-sm btn-accent" id="btn-submit-request" style="padding:10px 20px;">Submit Request</button>
        </div>
      </div>
    `);
    document.getElementById('btn-submit-request').addEventListener('click', () => {
      const reason = document.getElementById('delete-reason').value.trim();
      if (!reason) { toast('You must provide a reason', 'error'); return; }
      if (reason.length < 5) { toast('Reason must be at least 5 characters', 'error'); return; }
      // Create deletion request
      const delReq = {
        id: 'req-' + Date.now(),
        orderId: order.id,
        customerName: order.customerName,
        serviceType: order.serviceType,
        amount: order.totalCost,
        reason: reason,
        requestedBy: 'staff',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      };
      State.deleteRequests.push(delReq);
      saveDeleteRequests();
      DB.saveDeleteRequest(delReq);
      hideModal();
      renderAll();
      toast('Deletion request submitted. Waiting for Admin approval.');
    });
  }
}

function performDeleteOrder(oi, order, reason) {
  // Free machines
  State.machines.forEach(m => {
    if (m.wash.orderId === order.id) m.wash = { status: 'IDLE', orderId: null, customer: null, start: null, duration: 30, end: null };
    if (m.dry.orderId === order.id) m.dry = { status: 'IDLE', orderId: null, customer: null, start: null, duration: 40, end: null };
  });
  State.orders.splice(oi, 1);
  State.deletedLog.unshift({
    id: 'del-' + Date.now(),
    orderId: order.id,
    customer: order.customerName,
    service: order.serviceType,
    amount: order.totalCost,
    by: State.role,
    reason: reason,
    date: new Date().toISOString()
  });
  saveOrders(); saveMachines(); saveDeletedLog();
  // Sync to DB
  DB.deleteOrder(order.id);
  State.machines.forEach(m => DB.updateMachine(m));
  renderAll();
  toast(`Order ${order.id} deleted`);
}

// Admin: approve deletion request
function approveDeleteRequest(reqId) {
  const ri = State.deleteRequests.findIndex(r => r.id === reqId);
  if (ri < 0) return;
  const req = State.deleteRequests[ri];
  const oi = State.orders.findIndex(o => o.id === req.orderId);
  if (oi < 0) {
    State.deleteRequests[ri].status = 'approved';
    saveDeleteRequests();
    DB.updateDeleteRequest({ id: reqId, status: 'approved', approvedAt: new Date().toISOString() });
    toast('Order already deleted');
    renderAdmin();
    return;
  }
  const order = State.orders[oi];
  State.deleteRequests[ri].status = 'approved';
  State.deleteRequests[ri].approvedAt = new Date().toISOString();
  saveDeleteRequests();
  DB.updateDeleteRequest({ id: reqId, status: 'approved', approvedAt: new Date().toISOString() });
  performDeleteOrder(oi, order, `Staff request: ${req.reason}`);
  renderAdmin();
  toast(`Request approved. Order ${req.orderId} deleted.`);
}

// Admin: deny deletion request
function denyDeleteRequest(reqId) {
  const ri = State.deleteRequests.findIndex(r => r.id === reqId);
  if (ri < 0) return;
  State.deleteRequests[ri].status = 'denied';
  State.deleteRequests[ri].deniedAt = new Date().toISOString();
  saveDeleteRequests();
  DB.updateDeleteRequest({ id: reqId, status: 'denied', deniedAt: new Date().toISOString() });
  renderAdmin();
  toast('Deletion request denied.');
}

// ===== MACHINES VIEW =====
function renderMachinesView(container) {
  let html = '<div class="machines-grid">';
  State.machines.forEach(m => {
    const isMaint = m.maintenance;
    const maintBorder = isMaint ? 'border-color:rgba(239,68,68,0.3);opacity:0.7;' : '';
    const maintBadge = isMaint ? '<span style="font-size:0.55rem;background:rgba(239,68,68,0.15);color:var(--red);padding:2px 6px;border-radius:8px;font-weight:700;">🔧 MAINTENANCE</span>' : '';
    const adminToggle = State.role === 'admin' ? `<button class="btn-sm ${isMaint ? 'btn-success' : 'btn-danger'}" data-toggle-maint="${m.id}" style="font-size:0.5rem;padding:3px 6px;">${isMaint ? '✓ Activate' : '🔧 Disable'}</button>` : '';

    html += `<div class="machine-card" style="${maintBorder}">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div class="machine-name">${m.name} ${maintBadge}</div>
        ${adminToggle}
      </div>
      ${isMaint ? '<div style="text-align:center;padding:14px;color:var(--red);font-size:0.7rem;">Machine is under maintenance</div>' : `
      <div class="machine-slots">
        <div class="machine-slot ${m.wash.status.toLowerCase()}">
          <div class="slot-label">🫧 Washer</div>
          <div class="slot-status">${m.wash.status}</div>
          ${m.wash.status === 'RUNNING' ? `<div class="slot-timer" data-end="${m.wash.end}" data-type="wash-${m.id}">--:--</div><div class="slot-customer">${m.wash.customer}</div>` : ''}
          ${m.wash.status === 'FINISHED' ? `<div class="slot-customer">${m.wash.customer}</div><button class="btn-sm btn-accent" data-unload="wash-${m.id}">Unload</button>` : ''}
        </div>
        <div class="machine-slot ${m.dry.status.toLowerCase()}">
          <div class="slot-label">🌬️ Dryer</div>
          <div class="slot-status">${m.dry.status}</div>
          ${m.dry.status === 'RUNNING' ? `<div class="slot-timer" data-end="${m.dry.end}" data-type="dry-${m.id}">--:--</div><div class="slot-customer">${m.dry.customer}</div>` : ''}
          ${m.dry.status === 'FINISHED' ? `<div class="slot-customer">${m.dry.customer}</div><button class="btn-sm btn-accent" data-unload="dry-${m.id}">Unload</button>` : ''}
        </div>
      </div>`}
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;

  // Bind unload buttons
  container.querySelectorAll('[data-unload]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [type, id] = btn.dataset.unload.split('-');
      const mi = State.machines.findIndex(m => m.id === parseInt(id));
      if (mi < 0) return;
      if (type === 'wash') State.machines[mi].wash = { status: 'IDLE', orderId: null, customer: null, start: null, duration: 30, end: null };
      else State.machines[mi].dry = { status: 'IDLE', orderId: null, customer: null, start: null, duration: 40, end: null };
      saveMachines();
      DB.updateMachine(State.machines[mi]);
      renderOrdersPanel();
      toast('Machine unloaded');
    });
  });

  // Bind maintenance toggle (admin only)
  container.querySelectorAll('[data-toggle-maint]').forEach(btn => {
    btn.addEventListener('click', () => {
      const machineId = parseInt(btn.dataset.toggleMaint);
      const mi = State.machines.findIndex(m => m.id === machineId);
      if (mi < 0) return;
      State.machines[mi].maintenance = !State.machines[mi].maintenance;
      saveMachines();
      DB.updateMachine(State.machines[mi]);
      renderOrdersPanel();
      toast(State.machines[mi].maintenance ? `${State.machines[mi].name} set to MAINTENANCE` : `${State.machines[mi].name} reactivated`);
    });
  });
}

// Machine timer tick
function tickMachines() {
  const now = Date.now();
  let changed = false;
  State.machines.forEach(m => {
    if (m.wash.status === 'RUNNING' && m.wash.end && new Date(m.wash.end).getTime() <= now) {
      m.wash.status = 'FINISHED';
      State.machineLogs.push({ id: 'log-'+Date.now(), machine: m.name, type: 'WASH', orderId: m.wash.orderId, customer: m.wash.customer, start: m.wash.start, finished: new Date().toISOString(), duration: m.wash.duration });
      changed = true;
    }
    if (m.dry.status === 'RUNNING' && m.dry.end && new Date(m.dry.end).getTime() <= now) {
      m.dry.status = 'FINISHED';
      State.machineLogs.push({ id: 'log-'+Date.now()+'-d', machine: m.name, type: 'DRY', orderId: m.dry.orderId, customer: m.dry.customer, start: m.dry.start, finished: new Date().toISOString(), duration: m.dry.duration });
      changed = true;
    }
  });
  if (changed) { saveMachines(); saveMachineLogs(); renderMetrics(); }

  // Update timer displays
  document.querySelectorAll('.slot-timer').forEach(el => {
    const end = new Date(el.dataset.end).getTime();
    const remaining = Math.max(0, end - now);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    if (remaining <= 0) { renderOrdersPanel(); }
  });
}

// ===== REPORTS =====
function renderReports() {
  renderRevenueChart();
  renderServiceChart();
  renderTransactionTable();
  renderCommissionBreakdown();
  renderShiftHistory();
}

function renderRevenueChart() {
  const canvas = document.getElementById('chart-revenue');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width - 40;
  canvas.height = 200;

  // Group orders by date
  const grouped = {};
  State.orders.forEach(o => {
    const date = new Date(o.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    grouped[date] = (grouped[date] || 0) + o.totalCost;
  });
  const labels = Object.keys(grouped).slice(-14);
  const data = labels.map(l => grouped[l]);

  if (data.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No sales data yet', canvas.width / 2, 100);
    return;
  }

  const maxVal = Math.max(...data, 1);
  const w = canvas.width;
  const h = canvas.height;
  const padding = { top: 20, bottom: 30, left: 50, right: 20 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText('₱' + Math.round(maxVal - (maxVal / 4) * i), padding.left - 8, y + 4);
  }

  // Area fill
  const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  grad.addColorStop(0, 'rgba(59,130,246,0.2)');
  grad.addColorStop(1, 'rgba(59,130,246,0)');

  ctx.beginPath();
  ctx.moveTo(padding.left, h - padding.bottom);
  data.forEach((v, i) => {
    const x = padding.left + (chartW / (data.length - 1 || 1)) * i;
    const y = padding.top + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(padding.left + chartW, h - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  data.forEach((v, i) => {
    const x = padding.left + (chartW / (data.length - 1 || 1)) * i;
    const y = padding.top + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  data.forEach((v, i) => {
    const x = padding.left + (chartW / (data.length - 1 || 1)) * i;
    const y = padding.top + chartH - (v / maxVal) * chartH;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = '#3b82f6'; ctx.fill();
  });

  // Labels
  ctx.fillStyle = '#6b7280'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    const x = padding.left + (chartW / (data.length - 1 || 1)) * i;
    ctx.fillText(l, x, h - 8);
  });
}

function renderServiceChart() {
  const canvas = document.getElementById('chart-services');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 200;

  const counts = { 'Wash & Fold': 0, 'Dry Clean': 0, 'Premium': 0, 'Ironing': 0 };
  State.orders.forEach(o => {
    if (o.serviceType === 'WASH_FOLD') counts['Wash & Fold']++;
    else if (o.serviceType === 'DRY_CLEAN') counts['Dry Clean']++;
    else if (o.serviceType === 'PREMIUM') counts['Premium']++;
    else if (o.serviceType === 'IRONING') counts['Ironing']++;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(counts);

  ctx.clearRect(0, 0, 200, 200);

  if (total === 0) {
    ctx.fillStyle = '#6b7280'; ctx.font = '12px Inter'; ctx.textAlign = 'center';
    ctx.fillText('No data', 100, 105);
  } else {
    let startAngle = -Math.PI / 2;
    entries.forEach(([name, val], i) => {
      const sliceAngle = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(100, 100);
      ctx.arc(100, 100, 80, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = PIE_COLORS[i];
      ctx.fill();
      startAngle += sliceAngle;
    });
    // Inner circle (donut)
    ctx.beginPath(); ctx.arc(100, 100, 50, 0, Math.PI * 2); ctx.fillStyle = '#111827'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Inter'; ctx.textAlign = 'center';
    ctx.fillText(total, 100, 105);
    ctx.fillStyle = '#9ca3af'; ctx.font = '9px Inter';
    ctx.fillText('orders', 100, 118);
  }

  // Legend
  const legend = document.getElementById('chart-legend');
  legend.innerHTML = entries.map(([name, val], i) => `
    <div class="legend-item"><span class="legend-dot" style="background:${PIE_COLORS[i]}"></span>${name}: ${val}</div>
  `).join('');
}

function renderTransactionTable() {
  const tbody = document.getElementById('transactions-body');
  if (!tbody) return;
  tbody.innerHTML = State.orders.map(o => {
    // Build transition timeline
    let timelineHtml = '';
    if (o.transitions && o.transitions.length > 0) {
      timelineHtml = '<div class="order-timeline" style="display:none;padding:12px 14px;background:var(--bg-input);border-radius:8px;margin-top:8px;font-size:0.65rem;" data-timeline="' + o.id + '">';
      timelineHtml += '<div style="font-weight:700;color:var(--text-primary);margin-bottom:8px;">⏱️ Order Timeline</div>';
      o.transitions.forEach((t, i) => {
        const time = new Date(t.at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
        const machine = t.to === 'WASHING' ? (o.washMachine || '') : t.to === 'DRYING' ? (o.dryMachine || '') : '';
        const machineLabel = machine ? ` <span style="color:var(--purple);">[${machine}]</span>` : '';
        const durationLabel = t.durationMins > 0 ? ` <span style="color:var(--amber);">(${t.durationMins} min)</span>` : '';
        const statusColor = { PENDING: 'var(--amber)', WASHING: 'var(--blue)', DRYING: 'var(--purple)', READY: 'var(--emerald)', COMPLETED: 'var(--text-muted)' }[t.to] || 'var(--text-muted)';
        timelineHtml += `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">
          <span style="color:var(--text-muted);min-width:50px;">${time}</span>
          <span style="width:6px;height:6px;border-radius:50%;background:${statusColor};"></span>
          <span style="color:${statusColor};font-weight:600;">${t.to}</span>${machineLabel}${durationLabel}
        </div>`;
      });
      // Total processing time
      if (o.transitions.length > 1) {
        const first = new Date(o.transitions[0].at).getTime();
        const last = new Date(o.transitions[o.transitions.length - 1].at).getTime();
        const totalMins = Math.round((last - first) / 60000);
        timelineHtml += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-weight:700;color:var(--teal);">Total: ${totalMins} minutes</div>`;
      }
      timelineHtml += '</div>';
    }

    // Calculate total time
    let totalTime = '-';
    if (o.transitions && o.transitions.length > 1) {
      const first = new Date(o.transitions[0].at).getTime();
      const last = new Date(o.transitions[o.transitions.length - 1].at).getTime();
      const mins = Math.round((last - first) / 60000);
      totalTime = mins > 0 ? `${mins}m` : '<1m';
    }

    const proofBtn = o.paymentProof ? `<button class="btn-sm btn-accent" onclick="viewPaymentProof('${o.id}')" style="font-size:0.58rem;padding:3px 8px;">📷 View Proof</button>` : '<span style="font-size:0.6rem;color:var(--text-muted);">—</span>';
    const timelineToggle = o.transitions && o.transitions.length > 1 ? `<button class="btn-sm btn-ghost" onclick="toggleTimeline('${o.id}')" style="font-size:0.55rem;padding:2px 6px;">📋 Timeline</button>` : '';

    // Consumables display
    const consDisplay = (o.consumables || []).length > 0
      ? (o.consumables || []).map(c => `<div style="font-size:0.58rem;">${c.name} x${c.qty} = ₱${c.qty * c.unitPrice}</div>`).join('')
      : '<span style="font-size:0.6rem;color:var(--text-muted);">—</span>';

    // Commission
    let comm = o.staffCommission || 0;
    if (!comm && o.selectedServices) {
      const lds = Math.ceil((o.weightKg||8)/8)||1;
      (o.selectedServices||[]).forEach(k => { const s = State.services[k]; if(s&&s.staffCommission) comm += s.staffCommission*lds; });
    }
    const commDisplay = comm > 0 ? `<span style="font-size:0.65rem;color:var(--amber);font-weight:700;">₱${comm}</span>` : '<span style="font-size:0.6rem;color:var(--text-muted);">—</span>';

    return `<tr>
      <td class="td-id">${o.id}</td>
      <td style="font-weight:600">${o.customerName}</td>
      <td>${(o.selectedServices||[o.serviceType]).map(k => State.services[k]?.name || k).join(' + ')}</td>
      <td style="text-align:center">${o.weightKg.toFixed(1)} kg</td>
      <td>${consDisplay}</td>
      <td class="td-amount">${formatCurrency(o.totalCost)}</td>
      <td>${commDisplay}</td>
      <td><span class="status-badge ${o.status.toLowerCase()}">${o.status}</span><br><span style="font-size:0.58rem;color:var(--amber);">${totalTime}</span> ${timelineToggle}</td>
      <td style="font-size:0.68rem;">${o.payment || 'CASH'}<br>${proofBtn}</td>
      <td class="td-actions"><button class="btn-sm btn-danger" onclick="deleteOrder('${o.id}')">✕</button></td>
    </tr>
    <tr class="timeline-row" style="display:none;" data-timeline-row="${o.id}"><td colspan="10" style="padding:0 14px 12px;">${timelineHtml}</td></tr>`;
  }).join('') || '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">No transactions</td></tr>';
}

// Toggle timeline visibility
function toggleTimeline(orderId) {
  const row = document.querySelector(`[data-timeline-row="${orderId}"]`);
  const timeline = document.querySelector(`[data-timeline="${orderId}"]`);
  if (row && timeline) {
    const isVisible = row.style.display !== 'none';
    row.style.display = isVisible ? 'none' : 'table-row';
    timeline.style.display = isVisible ? 'none' : 'block';
  }
}

// ===== COMMISSION BREAKDOWN (Reports) =====
function renderCommissionBreakdown() {
  let container = document.getElementById('commission-breakdown');
  if (!container) return;

  // Calculate commission for all orders (even if field not stored)
  const ordersWithCommission = State.orders.map(o => {
    let comm = o.staffCommission || 0;
    if (!comm && o.selectedServices) {
      const loads = Math.ceil((o.weightKg || 8) / 8) || 1;
      o.selectedServices.forEach(k => {
        const s = State.services[k];
        if (s && s.staffCommission) comm += s.staffCommission * loads;
      });
    }
    return { ...o, calcCommission: comm };
  }).filter(o => o.calcCommission > 0);

  const totalCommission = ordersWithCommission.reduce((sum, o) => sum + o.calcCommission, 0);
  const totalRevenue = State.orders.reduce((sum, o) => sum + o.totalCost, 0);
  const ownerEarnings = totalRevenue - totalCommission;

  // Group by service type
  const byService = {};
  ordersWithCommission.forEach(o => {
    (o.selectedServices || [o.serviceType]).forEach(svc => {
      const s = State.services[svc];
      if (s && s.staffCommission) {
        if (!byService[svc]) byService[svc] = { name: s.name, icon: s.icon, commission: s.staffCommission, count: 0, total: 0 };
        byService[svc].count++;
        byService[svc].total += s.staffCommission;
      }
    });
  });

  let html = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);text-align:center;">
        <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Total Revenue</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--emerald);margin-top:4px;">${formatCurrency(totalRevenue)}</div>
      </div>
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid rgba(245,158,11,0.2);text-align:center;">
        <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Staff Commission</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--amber);margin-top:4px;">${formatCurrency(totalCommission)}</div>
      </div>
      <div style="padding:14px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid rgba(59,130,246,0.2);text-align:center;">
        <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Owner Net</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--blue);margin-top:4px;">${formatCurrency(ownerEarnings)}</div>
      </div>
    </div>`;

  // Commission by service breakdown
  html += `<div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Commission per Service</div>`;
  Object.entries(byService).forEach(([key, data]) => {
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:var(--radius-xs);border:1px solid var(--border);margin-bottom:6px;">
      <div>
        <span style="font-size:0.75rem;font-weight:600;">${data.icon} ${data.name}</span>
        <span style="font-size:0.6rem;color:var(--text-muted);margin-left:8px;">₱${data.commission}/load × ${data.count} orders</span>
      </div>
      <span style="font-size:0.78rem;font-weight:800;color:var(--amber);">${formatCurrency(data.total)}</span>
    </div>`;
  });

  if (Object.keys(byService).length === 0) {
    html += '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.72rem;">No commission data yet. Fold and Full Service orders generate staff commission.</div>';
  }

  // Recent orders with commission
  if (ordersWithCommission.length > 0) {
    html += `<div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-top:14px;margin-bottom:8px;">Recent Commission Orders</div>`;
    ordersWithCommission.slice(0, 10).forEach(o => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:var(--radius-xs);border:1px solid var(--border);margin-bottom:4px;font-size:0.68rem;">
        <div>
          <span style="font-weight:600;">${o.customerName}</span>
          <span style="color:var(--text-muted);margin-left:6px;">${formatDate(o.createdAt)}</span>
        </div>
        <div style="text-align:right;">
          <span style="color:var(--text-muted);">Order: ${formatCurrency(o.totalCost)}</span>
          <span style="color:var(--amber);font-weight:700;margin-left:8px;">Commission: ₱${o.calcCommission}</span>
        </div>
      </div>`;
    });
  }

  container.innerHTML = html;
}

// ===== SHIFT HISTORY (Reports) =====
function renderShiftHistory() {
  let container = document.getElementById('shift-history');
  if (!container) return;
  
  const shifts = State.shifts.slice(0, 20);
  if (shifts.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.72rem;">No shift records yet. Staff clock in/out to generate reports.</div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  shifts.forEach(s => {
    const clockIn = new Date(s.clockIn).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const clockOut = s.clockOut ? new Date(s.clockOut).toLocaleString('en-PH', { hour:'2-digit', minute:'2-digit' }) : 'Active';
    const hours = s.stats ? Math.floor(s.stats.durationMins / 60) : 0;
    const mins = s.stats ? s.stats.durationMins % 60 : 0;
    html += `<div style="padding:12px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:0.72rem;font-weight:700;">${s.staffName}</div>
        <div style="font-size:0.6rem;color:var(--text-muted);">${clockIn} → ${clockOut} (${hours}h ${mins}m)</div>
        ${s.stats && s.stats.totalCyclesUsed ? `<div style="font-size:0.58rem;color:var(--purple);margin-top:2px;">🔄 ${s.stats.totalCyclesUsed} machine cycles</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.78rem;font-weight:800;color:var(--emerald);">${s.stats ? formatCurrency(s.stats.revenue) : '—'}</div>
        <div style="font-size:0.58rem;color:var(--text-muted);">${s.stats ? s.stats.totalOrders + ' orders' : ''}</div>
        ${s.stats && s.stats.staffCommission ? `<div style="font-size:0.55rem;color:var(--amber);">Commission: ₱${s.stats.staffCommission}</div>` : ''}
      </div>
      <button class="btn-sm btn-ghost" onclick="viewShiftDetail('${s.id}')" style="font-size:0.55rem;padding:4px 8px;">👁️</button>
      <button class="btn-sm btn-ghost" onclick="printShiftReport('${s.id}')" style="font-size:0.55rem;padding:4px 8px;">🖨️</button>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// View shift detail with cycle counts
function viewShiftDetail(shiftId) {
  const shift = State.shifts.find(s => s.id === shiftId);
  if (!shift || !shift.stats) { toast('No data for this shift', 'error'); return; }
  const s = shift.stats;
  const hours = Math.floor(s.durationMins / 60);
  const mins = s.durationMins % 60;

  let cycleHtml = '';
  if (s.cycleSummary && s.cycleSummary.length > 0) {
    cycleHtml = `<div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Machine Cycle Counts (${s.totalCyclesUsed || 0} total)</div>`;
    cycleHtml += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:0.6rem;font-weight:700;color:var(--text-muted);padding-bottom:4px;border-bottom:1px solid var(--border);"><span>Machine</span><span>Wash (+used)</span><span>Dry (+used)</span></div>`;
    s.cycleSummary.forEach(c => {
      cycleHtml += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:0.68rem;padding:4px 0;border-bottom:1px solid var(--border);">
        <span style="font-weight:600;">${c.name.replace('BrightWash-','')}</span>
        <span>${c.washStart}→${c.washEnd} <span style="color:var(--teal);font-weight:700;">(+${c.washUsed})</span></span>
        <span>${c.dryStart}→${c.dryEnd} <span style="color:var(--purple);font-weight:700;">(+${c.dryUsed})</span></span>
      </div>`;
    });
  } else {
    cycleHtml = '<div style="font-size:0.7rem;color:var(--text-muted);">No cycle count data for this shift</div>';
  }

  showModal(`
    <div>
      <h3 class="modal-title">📊 Shift Detail — ${shift.staffName}</h3>
      <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:12px;font-size:0.7rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Clock In:</span><span>${new Date(shift.clockIn).toLocaleString('en-PH')}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Clock Out:</span><span>${new Date(shift.clockOut).toLocaleString('en-PH')}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Duration:</span><span style="font-weight:700;">${hours}h ${mins}m</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Orders:</span><span style="font-weight:700;">${s.totalOrders}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Revenue:</span><span style="font-weight:700;color:var(--emerald);">${formatCurrency(s.revenue)}</span></div>
        ${s.staffCommission ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Staff Commission:</span><span style="font-weight:700;color:var(--amber);">₱${s.staffCommission}</span></div>` : ''}
      </div>
      <div style="padding:12px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:16px;">
        ${cycleHtml}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Close</button>
        <button class="btn-sm btn-primary" onclick="printShiftReport('${shift.id}')" style="padding:10px 20px;">🖨️ Print</button>
      </div>
    </div>
  `);
}

// ===== ADMIN =====
function renderAdmin() {
  renderServicesConfig();
  renderRewardsConfig();
  renderStaffManagement();
  renderSheetsSync();
  renderDeleteRequests();
}

function renderDeleteRequests() {
  // Find or create container in admin panel
  let container = document.getElementById('delete-requests');
  if (!container) return;

  const pending = State.deleteRequests.filter(r => r.status === 'pending');
  const history = State.deleteRequests.filter(r => r.status !== 'pending').slice(0, 10);

  let html = '';
  if (pending.length > 0) {
    html += `<div style="margin-bottom:12px;font-size:0.72rem;font-weight:700;color:var(--amber);">⏳ Pending Requests (${pending.length})</div>`;
    pending.forEach(r => {
      html += `<div style="padding:14px;border-radius:var(--radius-sm);border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--text-primary);">${r.customerName}</div>
            <div style="font-size:0.62rem;color:var(--blue);font-family:monospace;">${r.orderId}</div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;">Amount: <strong style="color:var(--emerald);">${formatCurrency(r.amount)}</strong></div>
            <div style="font-size:0.65rem;color:var(--amber);margin-top:6px;font-style:italic;">"${r.reason}"</div>
            <div style="font-size:0.58rem;color:var(--text-muted);margin-top:4px;">Requested: ${formatDate(r.requestedAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button class="btn-sm btn-success" onclick="approveDeleteRequest('${r.id}')" style="font-size:0.6rem;">✓ Approve</button>
            <button class="btn-sm btn-danger" onclick="denyDeleteRequest('${r.id}')" style="font-size:0.6rem;">✕ Deny</button>
          </div>
        </div>
      </div>`;
    });
  } else {
    html += `<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.72rem;">No pending deletion requests</div>`;
  }

  if (history.length > 0) {
    html += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">Recent History</div>`;
    history.forEach(r => {
      const statusColor = r.status === 'approved' ? 'var(--emerald)' : 'var(--red)';
      const statusLabel = r.status === 'approved' ? '✓ Approved' : '✕ Denied';
      html += `<div style="padding:8px 12px;border-radius:var(--radius-xs);border:1px solid var(--border);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:0.68rem;font-weight:600;">${r.customerName}</span>
          <span style="font-size:0.58rem;color:var(--text-muted);margin-left:6px;">${r.orderId}</span>
        </div>
        <span style="font-size:0.6rem;font-weight:700;color:${statusColor};">${statusLabel}</span>
      </div>`;
    });
  }

  container.innerHTML = html;
}

function renderServicesConfig() {
  const container = document.getElementById('services-config');
  if (!container) return;
  let html = '';
  Object.entries(State.services).forEach(([key, svc]) => {
    html += `<div class="config-item" style="flex-direction:column;align-items:stretch;gap:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.78rem;font-weight:700;">${svc.icon} ${svc.name}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn-sm btn-accent" onclick="editService('${key}')" style="font-size:0.58rem;">✏️ Edit</button>
          <button class="btn-sm btn-danger" onclick="removeService('${key}')" style="font-size:0.58rem;">✕</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:0.65rem;color:var(--text-muted);">Rate:</span>
        <span style="font-size:0.65rem;color:var(--text-muted);">₱</span>
        <input type="number" value="${svc.rate}" data-service="${key}" class="svc-rate-input" style="width:80px;">
        <span style="font-size:0.65rem;color:var(--text-muted);">per ${svc.unit}</span>
      </div>
    </div>`;
  });
  html += `<button class="btn-sm btn-primary" id="btn-add-service" style="margin-top:12px;width:100%;padding:10px;">+ Add New Service</button>`;
  container.innerHTML = html;

  // Rate change listeners
  container.querySelectorAll('.svc-rate-input').forEach(input => {
    input.addEventListener('change', () => {
      State.services[input.dataset.service].rate = parseFloat(input.value) || 0;
      saveServices();
      toast('Service rate updated');
    });
  });

  // Add service button
  document.getElementById('btn-add-service')?.addEventListener('click', showAddServiceModal);
}

function showAddServiceModal() {
  showModal(`
    <div>
      <h3 class="modal-title">+ Add New Service</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Service Name</label><input type="text" id="svc-new-name" placeholder="e.g. Shoe Cleaning" style="width:100%;"></div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Rate (₱)</label><input type="number" id="svc-new-rate" placeholder="150" style="width:100%;"></div>
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Unit</label><select id="svc-new-unit" style="width:100%;padding:12px;"><option value="kg">per kg</option><option value="item">per item</option><option value="pair">per pair</option><option value="set">per set</option><option value="load">per load</option></select></div>
        </div>
        <div><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Icon (emoji)</label><input type="text" id="svc-new-icon" placeholder="🧹" maxlength="4" style="width:80px;text-align:center;font-size:1.2rem;"></div>
        <div><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Duration (minutes)</label><input type="number" id="svc-new-duration" placeholder="30" value="30" style="width:100px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
          <button class="btn-sm btn-primary" id="btn-save-new-service" style="padding:10px 20px;">Save Service</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('btn-save-new-service').addEventListener('click', () => {
    const name = document.getElementById('svc-new-name').value.trim();
    const rate = parseFloat(document.getElementById('svc-new-rate').value) || 0;
    const unit = document.getElementById('svc-new-unit').value;
    const icon = document.getElementById('svc-new-icon').value.trim() || '🧺';
    const duration = parseInt(document.getElementById('svc-new-duration').value) || 30;
    if (!name) { toast('Service name is required', 'error'); return; }
    if (rate <= 0) { toast('Rate must be greater than 0', 'error'); return; }
    // Generate key from name
    const key = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (State.services[key]) { toast('Service with similar name already exists', 'error'); return; }
    State.services[key] = { name, rate, unit, icon, duration };
    saveServices();
    DB.saveService(key, { name, rate, unit, icon, duration });
    hideModal();
    renderServicesConfig();
    toast(`Service "${name}" added!`);
  });
}

function editService(key) {
  const svc = State.services[key];
  if (!svc) return;
  showModal(`
    <div>
      <h3 class="modal-title">✏️ Edit Service</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Service Name</label><input type="text" id="svc-edit-name" value="${svc.name}" style="width:100%;"></div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Rate (₱)</label><input type="number" id="svc-edit-rate" value="${svc.rate}" style="width:100%;"></div>
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Unit</label><select id="svc-edit-unit" style="width:100%;padding:12px;"><option value="kg" ${svc.unit==='kg'?'selected':''}>per kg</option><option value="item" ${svc.unit==='item'?'selected':''}>per item</option><option value="pair" ${svc.unit==='pair'?'selected':''}>per pair</option><option value="set" ${svc.unit==='set'?'selected':''}>per set</option><option value="load" ${svc.unit==='load'?'selected':''}>per load</option></select></div>
        </div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Duration (min)</label><input type="number" id="svc-edit-duration" value="${svc.duration || 30}" style="width:100%;"></div>
          <div style="flex:1;"><label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Icon (emoji)</label><input type="text" id="svc-edit-icon" value="${svc.icon}" maxlength="4" style="width:100%;text-align:center;font-size:1.2rem;"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
          <button class="btn-sm btn-primary" id="btn-save-edit-service" style="padding:10px 20px;">Save Changes</button>
        </div>
      </div>
    </div>
  `);
  document.getElementById('btn-save-edit-service').addEventListener('click', () => {
    const name = document.getElementById('svc-edit-name').value.trim();
    const rate = parseFloat(document.getElementById('svc-edit-rate').value) || 0;
    const unit = document.getElementById('svc-edit-unit').value;
    const duration = parseInt(document.getElementById('svc-edit-duration').value) || 30;
    const icon = document.getElementById('svc-edit-icon').value.trim() || svc.icon;
    if (!name) { toast('Service name is required', 'error'); return; }
    if (rate <= 0) { toast('Rate must be greater than 0', 'error'); return; }
    State.services[key] = { name, rate, unit, icon, duration };
    saveServices();
    DB.saveService(key, { name, rate, unit, icon, duration });
    hideModal();
    renderServicesConfig();
    renderOrderForm();
    toast(`Service "${name}" saved!`);
  });
}

function removeService(key) {
  const svc = State.services[key];
  if (!svc) return;
  // Don't allow removing default services that have orders
  const hasOrders = State.orders.some(o => o.serviceType === key);
  if (hasOrders) {
    if (!confirm(`"${svc.name}" has existing orders. Removing it will keep old orders but this service won't be available for new orders. Continue?`)) return;
  } else {
    if (!confirm(`Remove service "${svc.name}"?`)) return;
  }
  delete State.services[key];
  saveServices();
  DB.deleteService(key);
  renderServicesConfig();
  toast(`Service "${svc.name}" removed`);
}

function renderRewardsConfig() {
  const container = document.getElementById('rewards-config');
  if (!container) return;
  const r = State.rewards;
  container.innerHTML = `
    <div class="config-item"><label>XP per ₱ spent</label><input type="number" step="0.05" value="${r.xpPerPhp}" id="cfg-xp"></div>
    <div class="config-item"><label>Points per ₱ spent</label><input type="number" step="0.01" value="${r.pointsPerPhp}" id="cfg-points"></div>
    <div class="config-item"><label>₱ saved per point</label><input type="number" step="0.1" value="${r.pointsToPhpRate}" id="cfg-rate"></div>
    <div class="config-item"><label>Express surcharge (₱)</label><input type="number" value="${r.expressSurcharge}" id="cfg-express"></div>
  `;
  ['cfg-xp', 'cfg-points', 'cfg-rate', 'cfg-express'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      State.rewards.xpPerPhp = parseFloat($('#cfg-xp').value) || 0;
      State.rewards.pointsPerPhp = parseFloat($('#cfg-points').value) || 0;
      State.rewards.pointsToPhpRate = parseFloat($('#cfg-rate').value) || 0;
      State.rewards.expressSurcharge = parseFloat($('#cfg-express').value) || 0;
      saveRewards();
      toast('Rewards config updated');
    });
  });
}

function renderStaffManagement() {
  const container = document.getElementById('staff-management');
  if (!container) return;
  let html = `
    <div class="add-form" style="margin-bottom:14px;">
      <input type="text" id="staff-name" placeholder="Display Name">
      <input type="text" id="staff-user" placeholder="Username">
      <input type="password" id="staff-pass" placeholder="Password">
      <button class="btn-sm btn-primary" id="btn-add-staff">+ Add Staff</button>
    </div>
    <div class="staff-list">`;
  State.staff.forEach(s => {
    html += `<div class="staff-item">
      <div class="staff-info">
        <span class="staff-name">${s.name}</span>
        <span class="staff-user">@${s.username}</span>
        <span style="font-size:0.55rem;color:var(--text-muted);">Pass: ${'•'.repeat(Math.min(s.password?.length || 0, 8))}</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="btn-sm btn-accent" data-change-pass="${s.username}" style="font-size:0.55rem;">🔑 Password</button>
        <button class="btn-sm btn-danger" data-del-staff="${s.username}" style="font-size:0.55rem;">✕</button>
      </div>
    </div>`;
  });
  if (State.staff.length === 0) html += '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.72rem;">No custom staff accounts</div>';
  html += '</div>';

  // Admin password change section
  html += `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);">
    <div style="font-size:0.68rem;font-weight:700;color:var(--text-muted);margin-bottom:8px;">Admin Password</div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="password" id="admin-new-pass" placeholder="New admin password" style="flex:1;">
      <button class="btn-sm btn-accent" id="btn-change-admin-pass">Update</button>
    </div>
  </div>`;

  container.innerHTML = html;

  // Add staff
  document.getElementById('btn-add-staff')?.addEventListener('click', () => {
    const name = $('#staff-name').value.trim();
    const user = $('#staff-user').value.trim().toLowerCase();
    const pass = $('#staff-pass').value;
    if (!name || !user || !pass) { toast('All fields required', 'error'); return; }
    if (user === 'admin') { toast('Username "admin" is reserved', 'error'); return; }
    if (State.staff.find(s => s.username === user)) { toast('Username exists', 'error'); return; }
    State.staff.push({ name, username: user, password: pass, created: new Date().toISOString() });
    saveStaff();
    DB.saveStaff({ name, username: user, password: pass }).then(r => {
      if (!r.success) { toast('DB save failed - check console', 'error'); console.error('[Staff]', r); }
      else { toast(`Staff "${name}" saved to database!`); }
    });
    renderStaffManagement();
  });

  // Delete staff
  container.querySelectorAll('[data-del-staff]').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.dataset.delStaff;
      if (!confirm(`Delete staff @${username}?`)) return;
      State.staff = State.staff.filter(s => s.username !== username);
      saveStaff();
      DB.deleteStaff(username);
      renderStaffManagement();
      toast('Staff removed');
    });
  });

  // Change staff password
  container.querySelectorAll('[data-change-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const username = btn.dataset.changePass;
      const staff = State.staff.find(s => s.username === username);
      if (!staff) return;
      showModal(`
        <div>
          <h3 class="modal-title">🔑 Change Password — @${username}</h3>
          <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:14px;">Staff: ${staff.name}</p>
          <input type="password" id="new-staff-pass" placeholder="New password" style="width:100%;margin-bottom:12px;">
          <input type="password" id="confirm-staff-pass" placeholder="Confirm password" style="width:100%;margin-bottom:16px;">
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button class="btn-sm btn-ghost" onclick="hideModal()" style="padding:10px 20px;">Cancel</button>
            <button class="btn-sm btn-primary" id="btn-save-staff-pass" style="padding:10px 20px;">Save Password</button>
          </div>
        </div>
      `);
      document.getElementById('btn-save-staff-pass').addEventListener('click', () => {
        const newPass = document.getElementById('new-staff-pass').value;
        const confirmPass = document.getElementById('confirm-staff-pass').value;
        if (!newPass || newPass.length < 4) { toast('Password must be at least 4 characters', 'error'); return; }
        if (newPass !== confirmPass) { toast('Passwords do not match', 'error'); return; }
        const si = State.staff.findIndex(s => s.username === username);
        if (si >= 0) {
          State.staff[si].password = newPass;
          saveStaff();
          DB.saveStaff({ name: staff.name, username, password: newPass });
          hideModal();
          renderStaffManagement();
          toast(`Password updated for @${username}`);
        }
      });
    });
  });

  // Change admin password
  document.getElementById('btn-change-admin-pass')?.addEventListener('click', () => {
    const newPass = document.getElementById('admin-new-pass').value;
    if (!newPass || newPass.length < 4) { toast('Password must be at least 4 characters', 'error'); return; }
    CONFIG.adminPass = newPass;
    store.set('bw_admin_pass', newPass);
    document.getElementById('admin-new-pass').value = '';
    toast('Admin password updated (local only — effective on this device until page reload)');
  });
}

function renderSheetsSync() {
  const container = document.getElementById('sheets-sync');
  if (!container) return;
  const url = store.get(CONFIG.storageKeys.sheetsUrl) || '';
  const lastSync = store.get(CONFIG.storageKeys.lastSync) || 'Never';

  container.innerHTML = `
    <div class="sync-section">
      <p style="font-size:0.72rem;color:var(--text-secondary);">Sync orders & customers to Google Sheets via Apps Script Web App. No login required.</p>
      <label style="font-size:0.65rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Apps Script URL</label>
      <input type="url" id="sheets-url" class="sync-input" placeholder="https://script.google.com/macros/s/.../exec" value="${url}">
      <button class="btn-sm btn-primary" id="btn-sync-now" style="align-self:flex-start;">Sync Now</button>
      <div class="sync-status">Last sync: ${lastSync}</div>
    </div>
  `;

  document.getElementById('sheets-url')?.addEventListener('change', (e) => {
    store.set(CONFIG.storageKeys.sheetsUrl, e.target.value.trim());
  });

  document.getElementById('btn-sync-now')?.addEventListener('click', performSync);
}

async function performSync() {
  const url = (store.get(CONFIG.storageKeys.sheetsUrl) || '').trim();
  if (!url || !url.startsWith('https://script.google.com/')) {
    toast('Please enter a valid Apps Script URL', 'error');
    return;
  }

  toast('Syncing...', 'info');
  const payload = {
    action: 'sync',
    customers: State.customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, level: c.level, xp: c.xp, points: c.points, totalOrders: c.totalOrders, joinedDate: c.joined, unlockedAchievements: c.achievements || [] })),
    orders: State.orders.map(o => ({
      id: o.id, customerId: o.customerId, customerName: o.customerName, serviceType: o.serviceType,
      items: o.items, weightKg: o.weightKg, isExpress: o.isExpress, totalCost: o.totalCost,
      xpEarned: o.xpEarned || 0, pointsEarned: o.pointsEarned || 0, status: o.status,
      createdAt: o.createdAt, payment: o.payment || 'CASH',
      hasPaymentProof: !!o.paymentProof,
      paymentProof: o.paymentProof || null,
      washMachine: o.washMachine || '', dryMachine: o.dryMachine || '',
      totalProcessingMins: (o.transitions && o.transitions.length > 1) ? Math.round((new Date(o.transitions[o.transitions.length-1].at).getTime() - new Date(o.transitions[0].at).getTime()) / 60000) : 0,
    })),
  };

  try {
    const res = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    
    const text = await res.text();
    
    // Check if response is HTML (error page) instead of JSON
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      // Google returned an error page - likely auth/permission issue
      if (text.includes('Hindi Nahanap') || text.includes('not found') || text.includes('404')) {
        toast('Sync failed: URL not found. Please redeploy your Apps Script and get a new URL.', 'error');
      } else if (text.includes('401') || text.includes('unauthorized')) {
        toast('Sync failed: Unauthorized. Set "Who has access" to "Anyone" in Apps Script deployment.', 'error');
      } else {
        toast('Sync failed: Google returned an error page. Check your Apps Script deployment.', 'error');
      }
      return;
    }
    
    try {
      const data = JSON.parse(text);
      if (data.success) {
        const now = new Date().toLocaleString('en-PH');
        store.set(CONFIG.storageKeys.lastSync, now);
        toast('Synced to Google Sheets!');
        renderSheetsSync();
      } else {
        toast('Sync failed: ' + (data.error || 'Script returned failure'), 'error');
      }
    } catch (parseErr) {
      toast('Sync failed: Invalid response from script. Response: ' + text.substring(0, 100), 'error');
    }
  } catch (err) {
    // Network error or CORS block
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      toast('Sync failed: Network/CORS error. Make sure the Apps Script URL is correct and deployed as "Anyone".', 'error');
    } else {
      toast('Sync failed: ' + err.message, 'error');
    }
  }
}

// ===== CSV EXPORT =====
function exportOrdersCSV() {
  const headers = ['Order ID','Customer','Services','Weight (kg)','Loads','Ariel (Twin)','Ariel Cost','Tide','Tide Cost','Downy','Downy Cost','Zonrox','Zonrox Cost','Supplies Total','Service Cost','Staff Commission','Total (PHP)','Payment','Status','Date'];
  const rows = State.orders.map(o => {
    const loads = Math.ceil((o.weightKg || 8) / 8) || 1;
    const cons = o.consumables || [];
    const getQty = (id) => { const c = cons.find(x => x.id === id); return c ? c.qty : 0; };
    const getCost = (id) => { const c = cons.find(x => x.id === id); return c ? c.qty * c.unitPrice : 0; };
    const suppliesTotal = cons.reduce((s, c) => s + (c.qty * c.unitPrice), 0);
    const servicesCost = o.totalCost - suppliesTotal;

    // Calculate commission if not stored
    let comm = o.staffCommission || 0;
    if (!comm && o.selectedServices) {
      o.selectedServices.forEach(k => { const s = State.services[k]; if (s && s.staffCommission) comm += s.staffCommission * loads; });
    }

    return [
      o.id,
      o.customerName,
      (o.selectedServices || [o.serviceType]).map(k => State.services[k]?.name || k).join(' + '),
      o.weightKg,
      loads,
      getQty('ariel_twin'),
      getCost('ariel_twin'),
      getQty('tide'),
      getCost('tide'),
      getQty('downy'),
      getCost('downy'),
      getQty('zonrox'),
      getCost('zonrox'),
      suppliesTotal,
      servicesCost,
      comm,
      o.totalCost,
      o.payment || 'CASH',
      o.status,
      o.createdAt ? new Date(o.createdAt).toLocaleString('en-PH') : '',
    ];
  });
  downloadCSV('brightwash_orders_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
  toast('Orders exported!');
}

function exportCustomersCSV() {
  const headers = ['ID','Name','Phone','Level','XP','Points','Total Orders','Joined'];
  const rows = State.customers.map(c => [
    c.id, c.name, c.phone, c.level, c.xp, c.points, c.totalOrders, c.joined
  ]);
  downloadCSV('brightwash_customers_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
  toast('Customers exported!');
}

function exportCommissionCSV() {
  const headers = ['Order ID','Customer','Services','Total (PHP)','Staff Commission','Owner Net','Date'];
  // Calculate commission for orders that may not have it stored
  const ordersWithComm = State.orders.map(o => {
    let comm = o.staffCommission || 0;
    if (!comm && o.selectedServices) {
      const loads = Math.ceil((o.weightKg || 8) / 8) || 1;
      o.selectedServices.forEach(k => {
        const s = State.services[k];
        if (s && s.staffCommission) comm += s.staffCommission * loads;
      });
    }
    return { ...o, calcCommission: comm };
  }).filter(o => o.calcCommission > 0);

  const rows = ordersWithComm.map(o => [
    o.id,
    o.customerName,
    (o.selectedServices || [o.serviceType]).map(k => State.services[k]?.name || k).join(' + '),
    o.totalCost,
    o.calcCommission,
    o.totalCost - o.calcCommission,
    o.createdAt ? new Date(o.createdAt).toLocaleString('en-PH') : '',
  ]);
  downloadCSV('brightwash_commission_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
  toast('Commission report exported!');
}

function downloadCSV(filename, headers, rows) {
  const escape = (val) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Login form
  $('#login-form').addEventListener('submit', handleLogin);
  $('#btn-logout').addEventListener('click', handleLogout);

  // Tab navigation
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Customer panel
  $('#btn-add-customer').addEventListener('click', () => {
    $('#add-customer-form').classList.toggle('hidden');
  });
  $('#btn-cancel-customer').addEventListener('click', () => {
    $('#add-customer-form').classList.add('hidden');
  });
  $('#btn-save-customer').addEventListener('click', addCustomer);
  $('#customer-search').addEventListener('input', (e) => renderCustomers(e.target.value));

  // Toggle orders/machines view
  $$('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.orderView = btn.dataset.view;
      renderOrdersPanel();
    });
  });

  // Reset transactions button
  document.getElementById('btn-reset-transactions')?.addEventListener('click', async () => {
    if (!confirm('⚠️ Reset ALL transactions? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? All orders, shifts, and customer points will be erased.')) return;
    
    toast('Resetting...', 'info');
    
    // Reset in database
    const result = await DB._fetch('setup.php?reset=orders', 'POST', {});
    if (result.success) {
      // Clear local state
      State.orders = [];
      State.machineLogs = [];
      State.machines = DEFAULT_MACHINES.map(m => JSON.parse(JSON.stringify(m)));
      State.deletedLog = [];
      State.deleteRequests = [];
      State.shifts = [];
      State.customers = State.customers.map(c => ({ ...c, level: 1, xp: 0, points: 0, achievements: [], totalOrders: 0 }));
      saveOrders(); saveMachines(); saveMachineLogs(); saveDeletedLog(); saveCustomers();
      store.set(CONFIG.storageKeys.deleteRequests, []);
      store.set(CONFIG.storageKeys.shifts, []);
      renderAll();
      renderReports();
      toast('All transactions reset successfully!');
    } else {
      toast('Reset failed: ' + (result.error || 'Unknown error'), 'error');
    }
  });

  // Modal close
  $('#modal-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) hideModal(); });

  // Auto-login if session exists
  if (State.role) {
    showApp();
  }

  // Machine timer tick every second
  setInterval(tickMachines, 1000);
  
  // Auto-sync from database every 60 seconds
  setInterval(() => {
    if (State.role) syncFromDB();
  }, 60000);
});
