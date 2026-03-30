// frontend/js/charts.js
function initChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas) {
    console.error('Canvas #priceChart not found');
    return;
  }

  // Set explicit canvas dimensions for initial render
  const ctx = canvas.getContext('2d');
  
  // Destroy existing chart if any
  if (window.priceChart) {
    window.priceChart.destroy();
    clearInterval(window._chartInterval);
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

  const data = generatePriceData(80, 1.08450);

  window.priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Price',
        data: data.prices,
        borderColor: '#10b981',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // Requires explicit container height!
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#111827',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(5)}`
          }
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#6b7280',
            font: { size: 11 },
            callback: (v) => v.toFixed(5)
          }
        }
      }
    }
  });

  // Live update every second
  window._chartInterval = setInterval(updateChart, 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChart);
} else {
  initChart();
}