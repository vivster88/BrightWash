/* BrightWash POS - Database API Layer */
'use strict';

const API_BASE = './api';

const DB = {
  // Generic fetch wrapper
  async _fetch(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, opts);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`[DB] ${method} ${endpoint} failed:`, err);
      return { success: false, error: err.message };
    }
  },

  // ===== CUSTOMERS =====
  async getCustomers() {
    const res = await this._fetch('customers.php');
    return res.success ? res.data : [];
  },
  async saveCustomer(customer) {
    return this._fetch('customers.php', 'POST', customer);
  },
  async updateCustomer(customer) {
    return this._fetch('customers.php', 'PUT', customer);
  },
  async deleteCustomer(id) {
    return this._fetch(`customers.php?id=${id}`, 'DELETE');
  },

  // ===== ORDERS =====
  async getOrders() {
    const res = await this._fetch('orders.php');
    return res.success ? res.data : [];
  },
  async saveOrder(order) {
    return this._fetch('orders.php', 'POST', order);
  },
  async updateOrder(order) {
    return this._fetch('orders.php', 'PUT', order);
  },
  async deleteOrder(id) {
    return this._fetch(`orders.php?id=${id}`, 'DELETE');
  },

  // ===== SERVICES =====
  async getServices() {
    const res = await this._fetch('services.php');
    return res.success ? res.data : null;
  },
  async saveService(key, service) {
    return this._fetch('services.php', 'POST', { key, ...service });
  },
  async deleteService(key) {
    return this._fetch(`services.php?key=${key}`, 'DELETE');
  },

  // ===== MACHINES =====
  async getMachines() {
    const res = await this._fetch('machines.php');
    return res.success ? res.data : [];
  },
  async updateMachine(machine) {
    return this._fetch('machines.php', 'PUT', machine);
  },

  // ===== SHIFTS =====
  async getShifts() {
    const res = await this._fetch('shifts.php');
    return res.success ? res.data : [];
  },
  async saveShift(shift) {
    return this._fetch('shifts.php', 'POST', shift);
  },

  // ===== STAFF =====
  async getStaff() {
    const res = await this._fetch('staff.php');
    return res.success ? res.data : [];
  },
  async saveStaff(staff) {
    return this._fetch('staff.php', 'POST', staff);
  },
  async deleteStaff(username) {
    return this._fetch(`staff.php?username=${username}`, 'DELETE');
  },

  // ===== DELETE REQUESTS =====
  async getDeleteRequests() {
    const res = await this._fetch('delete-requests.php');
    return res.success ? res.data : [];
  },
  async saveDeleteRequest(req) {
    return this._fetch('delete-requests.php', 'POST', req);
  },
  async updateDeleteRequest(req) {
    return this._fetch('delete-requests.php', 'PUT', req);
  },

  // ===== SETTINGS =====
  async getSettings() {
    const res = await this._fetch('settings.php');
    return res.success ? res.data : {};
  },
  async saveSetting(key, value) {
    return this._fetch('settings.php', 'POST', { key, value });
  },

  // ===== LOGIN =====
  async login(username, password) {
    return this._fetch('login.php', 'POST', { username, password });
  },

  // ===== FULL SYNC (load everything from DB) =====
  async loadAll() {
    const [customers, orders, services, machines, shifts, staff, deleteRequests, settings] = await Promise.all([
      this.getCustomers(),
      this.getOrders(),
      this.getServices(),
      this.getMachines(),
      this.getShifts(),
      this.getStaff(),
      this.getDeleteRequests(),
      this.getSettings(),
    ]);
    return { customers, orders, services, machines, shifts, staff, deleteRequests, settings };
  },
};
