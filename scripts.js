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
