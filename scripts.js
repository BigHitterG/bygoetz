const BAG_KEY = "bygoetz-bag";

function readBag() {
  return JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
}

function writeBag(items) {
  localStorage.setItem(BAG_KEY, JSON.stringify(items));
  updateBagCount();
}

function updateBagCount() {
  const count = readBag().length;
  document.querySelectorAll("[data-bag-count]").forEach((node) => {
    node.textContent = count;
  });
}

function renderBagPage() {
  const itemsNode = document.querySelector("#bag-items");
  const totalNode = document.querySelector("#bag-total");
  if (!itemsNode || !totalNode) return;

  const items = readBag();
  if (!items.length) {
    itemsNode.innerHTML = '<p class="empty-state">Your bag is empty. Start from a concept and add a product.</p>';
  } else {
    itemsNode.innerHTML = items
      .map((item) => `<div class="bag-row"><span>${item.product}</span><strong>$${item.price}</strong></div>`)
      .join("");
  }

  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  totalNode.textContent = `$${total}`;
}

document.querySelectorAll("[data-add-to-bag]").forEach((button) => {
  button.addEventListener("click", () => {
    const item = { product: button.dataset.product, price: button.dataset.price };
    writeBag([...readBag(), item]);
    button.textContent = "Added to bag";
  });
});

updateBagCount();
renderBagPage();

function initPlotMap() {
  const viewport = document.querySelector('[data-plot-viewport]');
  const grid = document.querySelector('[data-plot-grid]');
  const plots = Array.from(document.querySelectorAll('[data-plot]'));
  if (!viewport || !grid || !plots.length) return;

  const position = { x: -80, y: -80 };
  let drag = null;
  let didDrag = false;

  function applyPosition() {
    grid.style.setProperty('--plot-x', `${position.x}px`);
    grid.style.setProperty('--plot-y', `${position.y}px`);
  }

  function setCenteredPlot() {
    const bounds = viewport.getBoundingClientRect();
    const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    let closestPlot = plots[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    plots.forEach((plot) => {
      const rect = plot.getBoundingClientRect();
      const plotCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const distance = Math.hypot(center.x - plotCenter.x, center.y - plotCenter.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlot = plot;
      }
    });

    plots.forEach((plot) => plot.classList.toggle('is-centered', plot === closestPlot));
  }

  function moveBy(deltaX, deltaY) {
    position.x += deltaX;
    position.y += deltaY;
    applyPosition();
    setCenteredPlot();
  }

  viewport.addEventListener('pointerdown', (event) => {
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    didDrag = false;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) didDrag = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    moveBy(deltaX, deltaY);
  });

  viewport.addEventListener('pointerup', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    viewport.classList.remove('is-dragging');
  });

  viewport.addEventListener('pointercancel', () => {
    drag = null;
    viewport.classList.remove('is-dragging');
  });

  plots.forEach((plot) => {
    plot.addEventListener('click', (event) => {
      if (didDrag || plot.classList.contains('is-future')) {
        event.preventDefault();
      }
      setCenteredPlot();
    });
  });

  applyPosition();
  setCenteredPlot();
  window.addEventListener('resize', setCenteredPlot);
}

window.initPlotMap = initPlotMap;
initPlotMap();
