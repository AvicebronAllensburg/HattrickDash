/* charts.js – Wrapper um Chart.js für wiederkehrende Diagrammtypen */

window.HHCharts = (function () {
  const instances = new Map();

  function getCtx(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    if (instances.has(canvasId)) {
      instances.get(canvasId).destroy();
      instances.delete(canvasId);
    }
    return el.getContext('2d');
  }

  function bar(canvasId, labels, datasets, opts = {}) {
    const ctx = getCtx(canvasId);
    if (!ctx) return null;
    const c = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: !!datasets.length && datasets.length > 1 } },
        scales: {
          x: { stacked: !!opts.stacked },
          y: { stacked: !!opts.stacked, ticks: { callback: (v) => v.toLocaleString('de-DE') } },
        },
      },
    });
    instances.set(canvasId, c);
    return c;
  }

  function line(canvasId, labels, datasets) {
    const ctx = getCtx(canvasId);
    if (!ctx) return null;
    const c = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        elements: { line: { tension: 0.25 }, point: { radius: 2 } },
      },
    });
    instances.set(canvasId, c);
    return c;
  }

  function pie(canvasId, labels, values, colors) {
    const ctx = getCtx(canvasId);
    if (!ctx) return null;
    const c = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors }] },
      options: { responsive: true, maintainAspectRatio: false },
    });
    instances.set(canvasId, c);
    return c;
  }

  return { bar, line, pie };
})();
