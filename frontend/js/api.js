// frontend/js/api.js

const api = {
  baseURL: '/api',

  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status})`);
    }
    return data;
  },

  // Generic
  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  },
  put(endpoint, data) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  },

  // Auth
  register(data) { return this.post('/auth/register', data); },
  login(data) { return this.post('/auth/login', data); },
  getMe() { return this.get('/auth/me'); },
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/pages/login.html';
  },

  // User
  getStats() { return this.get('/user/stats'); },
  getProfile() { return this.get('/user/profile'); },
  updateProfile(data) { return this.put('/user/profile', data); },

  // Trades
  getTrades() { return this.get('/trades'); },
  getActiveTrades() { return this.get('/trades/active'); },
  getTradeHistory() { return this.get('/trades/history'); },
  placeTrade(data) { return this.post('/trades', data); },

  // Payments
  deposit(data) { return this.post('/payments/deposit', data); },
  withdraw(data) { return this.post('/payments/withdraw', data); },
  getTransactions() { return this.get('/payments/history'); },
};