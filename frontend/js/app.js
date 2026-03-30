// frontend/js/app.js
// Main application logic

document.addEventListener('DOMContentLoaded', () => {
  // Global error handler
  window.onerror = (msg, url, line) => {
    console.error(`Error: ${msg} at ${url}:${line}`);
    return false;
  };

  // Check auth status on page load
  checkAuthStatus();
});

function checkAuthStatus() {
  const token = localStorage.getItem('token');
  const publicPages = ['/', '/index.html', '/pages/login.html', '/pages/register.html'];
  const currentPage = window.location.pathname;

  if (!token && !publicPages.includes(currentPage)) {
    window.location.href = '/pages/login.html';
  }
}

// Utility functions
function formatCurrency(amount, currency = 'KES') {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function calculateTimeRemaining(expiryTime) {
  const remaining = new Date(expiryTime) - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}