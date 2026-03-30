// frontend/js/trading.js
// Handles trade resolution polling and notifications only
// Core trade functions live in dashboard.html to avoid conflicts

(function () {
  let _pollInterval = null;

  window.startTradePolling = function () {
    if (_pollInterval) clearInterval(_pollInterval);

    _pollInterval = setInterval(async () => {
      try {
        const trades = await api.get('/trades/active');

        // Update active count
        const countEl = document.getElementById('active-count');
        const openEl = document.getElementById('metric-open');
        if (countEl) countEl.textContent = trades.length;
        if (openEl) openEl.textContent = trades.length;

        // Re-render active trades list
        if (typeof renderActiveTrades === 'function') {
          window._activeTrades = trades;
          renderActiveTrades(trades);
        }
      } catch (err) {
        // Silently fail — user might not be logged in
      }
    }, 3000);
  };

  window.stopTradePolling = function () {
    if (_pollInterval) clearInterval(_pollInterval);
  };
})();