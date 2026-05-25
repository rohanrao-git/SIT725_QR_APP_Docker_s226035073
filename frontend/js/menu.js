const MENU_CATEGORIES = ["Appetizers", "Mains", "Desserts", "Sides", "Beverages"];
const CATEGORY_ALIASES = {
  appetizer: "Appetizers",
  appetizers: "Appetizers",
  main: "Mains",
  mains: "Mains",
  dessert: "Desserts",
  desserts: "Desserts",
  side: "Sides",
  sides: "Sides",
  beverage: "Beverages",
  beverages: "Beverages",
};
const GUEST_CONTEXT_KEY = "guestContext";
const LEGACY_SESSION_KEY = "guestSessionId";
const SESSION_KEY_PREFIX = "guestSessionId";

let cartState = {};
let menuItemNames = {};
let menuSocket = null;

document.addEventListener("DOMContentLoaded", async () => {
  M.Modal.init(document.querySelectorAll(".modal"));

  const restaurantId = getRestaurantIdFromUrl();
  const tableNumber = getQueryParam("table");

  if (!restaurantId) {
    showError("Invalid menu link — restaurant not found.");
    return;
  }

  storeGuestContext(restaurantId, tableNumber);
  updateTableLabel(tableNumber);
  setupCartDrawer();

  try {
    await startSession(restaurantId, tableNumber);
  } catch {
    // session start failing is non-fatal; cart won't work but menu still shows
  }

  await loadPublicMenu(restaurantId);
  initializeMenuSocket(restaurantId);
});

function getRestaurantIdFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const menuIndex = parts.indexOf("menu");
  if (menuIndex !== -1 && parts[menuIndex + 1]) {
    return parts[menuIndex + 1];
  }
  return getQueryParam("restaurantId");
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function storeGuestContext(restaurantId, tableNumber) {
  const context = { restaurantId };
  if (tableNumber) context.tableNumber = tableNumber;
  sessionStorage.setItem(GUEST_CONTEXT_KEY, JSON.stringify(context));
}

function getGuestContext() {
  try {
    return JSON.parse(sessionStorage.getItem(GUEST_CONTEXT_KEY)) || {};
  } catch {
    return {};
  }
}

function buildSessionStorageKey(restaurantId, tableNumber) {
  if (!restaurantId || tableNumber === undefined || tableNumber === null || tableNumber === "") {
    return null;
  }

  return `${SESSION_KEY_PREFIX}:${restaurantId}:${Number(tableNumber)}`;
}

async function startSession(restaurantId, tableNumber) {
  if (!tableNumber) return;

  const sessionKey = buildSessionStorageKey(restaurantId, tableNumber);
  if (!sessionKey) return;

  const existing = sessionStorage.getItem(sessionKey);
  if (existing) return;

  // Backward compatibility cleanup for older global key.
  sessionStorage.removeItem(LEGACY_SESSION_KEY);

  const res = await fetch(`${API_BASE_URL}/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, tableNumber: Number(tableNumber) }),
  });

  const data = await res.json();
  if (res.ok && data.session) {
    sessionStorage.setItem(sessionKey, data.session._id);
  }
}

function getSessionId() {
  const context = getGuestContext();
  const sessionKey = buildSessionStorageKey(context.restaurantId, context.tableNumber);
  if (!sessionKey) return null;
  return sessionStorage.getItem(sessionKey);
}

function updateTableLabel(tableNumber) {
  const tableLabel = document.getElementById("tableLabel");
  if (!tableLabel || !tableNumber) return;
  tableLabel.textContent = `Table ${tableNumber}`;
  tableLabel.classList.remove("hide");
}

function hideLoading() {
  const statusEl = document.getElementById("menuStatus");
  if (statusEl) statusEl.style.display = "none";
}

function showError(message) {
  hideLoading();
  const errorWrap = document.getElementById("menuError");
  const panel = errorWrap?.querySelector(".menu-error-panel span");
  if (errorWrap && panel) {
    panel.textContent = message;
    errorWrap.classList.remove("hide");
  }
}

async function loadPublicMenu(restaurantId) {
  try {
    const response = await fetch(`${API_BASE_URL}/menu/public/${restaurantId}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Failed to load menu");

    hideLoading();
    renderMenu(data.menu || []);

    const sessionId = getSessionId();
    if (sessionId) {
      const cartRes = await fetch(`${API_BASE_URL}/cart/${sessionId}`);
      const cartData = await cartRes.json();
      if (cartRes.ok && cartData.cart) {
        syncCartState(cartData.cart);
        cartData.cart.items.forEach((item) => {
          updateMenuCardButton(String(item.menuItemId), item.quantity);
        });
        updateCartBadge(cartData.cart.itemCount);
      }
    }
  } catch (error) {
    showError(error.message);
  }
}

function initializeMenuSocket(restaurantId) {
  if (typeof io !== "function" || menuSocket) return;

  menuSocket = io();

  menuSocket.on("connect", () => {
    menuSocket.emit("joinRestaurantMenu", restaurantId);
  });

  menuSocket.on("menuUpdated", async () => {
    await loadPublicMenu(restaurantId);
    await refreshCartDrawer();
  });
}

const CATEGORY_ICONS = {
  Appetizers: "🥗",
  Mains: "🍽️",
  Desserts: "🍰",
  Sides: "🥙",
  Beverages: "🥤",
};

function renderMenu(items) {
  const container = document.getElementById("menuContainer");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="menu-empty-state">
        <span class="menu-empty-icon">🍽️</span>
        <p class="menu-empty-title">No items available right now</p>
        <p class="menu-empty-sub">Please check back later</p>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    menuItemNames[item._id] = item.name;
  });

  const sections = MENU_CATEGORIES.map((category) => {
    const categoryItems = items.filter(
      (item) => normalizeCategory(item.category) === category
    );
    if (!categoryItems.length) return "";

    const icon = CATEGORY_ICONS[category] || "🍴";
    return `
      <section class="menu-category-section">
        <div class="menu-category-header">
          <span class="menu-category-emoji">${icon}</span>
          <h5 class="menu-category-title">${escapeHtml(category)}</h5>
        </div>
        <div class="menu-items-grid">
          ${categoryItems.map(renderMenuItemCard).join("")}
        </div>
      </section>
    `;
  }).filter(Boolean);

  container.innerHTML = sections.length
    ? sections.join("")
    : `<div class="menu-empty-state"><p>No items to display.</p></div>`;

  if (getSessionId()) {
    document.getElementById("cartNavBtn")?.classList.remove("hide");
    document.getElementById("floatingCartBtn")?.classList.remove("hide");
  }
}

function renderMenuItemCard(item) {
  const isVeg = item.dietaryType === "veg";
  const showDietary = normalizeCategory(item.category) !== "Beverages" && item.dietaryType;

  const imageSectionHtml = item.image
    ? `<div class="mic-image">
         <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />
       </div>`
    : "";

  const dietaryDot = showDietary
    ? `<span class="dietary-dot ${isVeg ? "dot-veg" : "dot-nonveg"}" title="${isVeg ? "Vegetarian" : "Non-Vegetarian"}"></span>`
    : "";

  const hasSession = !!getSessionId();
  const qty = cartState[item._id] || 0;

  const cartControl = !hasSession
    ? ""
    : qty > 0
    ? `<div class="mic-qty-ctrl" data-id="${escapeHtml(item._id)}">
         <button class="mic-qty-card-btn mic-qty-card-dec" data-id="${escapeHtml(item._id)}">
           <i class="material-icons">remove</i>
         </button>
         <span class="mic-qty-card-num">${qty}</span>
         <button class="mic-qty-card-btn mic-qty-card-inc" data-id="${escapeHtml(item._id)}">
           <i class="material-icons">add</i>
         </button>
       </div>`
    : `<button
         class="mic-add-btn add-to-cart-btn"
         data-id="${escapeHtml(item._id)}"
         data-name="${escapeHtml(item.name)}"
       >
         <i class="material-icons" style="font-size:1.15rem;">add</i>
       </button>`;

  return `
    <div class="menu-item-card" data-item-id="${escapeHtml(item._id)}">
      ${imageSectionHtml}
      <div class="mic-body">
        <div class="mic-top">
          <div class="mic-name-row">
            ${dietaryDot}
            <span class="mic-name">${escapeHtml(item.name || "Item")}</span>
          </div>
          ${item.description ? `<p class="mic-desc">${escapeHtml(item.description)}</p>` : ""}
        </div>
        <div class="mic-bottom">
          <span class="mic-price">$${Number(item.price || 0).toFixed(2)}</span>
          ${cartControl}
        </div>
      </div>
    </div>
  `;
}

function normalizeCategory(category) {
  const normalized = CATEGORY_ALIASES[String(category || "").trim().toLowerCase()];
  return normalized || "Mains";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function syncCartState(cart) {
  cartState = {};
  (cart.items || []).forEach((item) => {
    cartState[String(item.menuItemId)] = item.quantity;
  });
}

function updateMenuCardButton(menuItemId, quantity) {
  const card = document.querySelector(`.menu-item-card[data-item-id="${menuItemId}"]`);
  if (!card) return;
  const bottom = card.querySelector(".mic-bottom");
  if (!bottom) return;

  const existing = bottom.querySelector(".mic-add-btn, .mic-qty-ctrl");
  if (existing) existing.remove();

  if (quantity > 0) {
    const ctrl = document.createElement("div");
    ctrl.className = "mic-qty-ctrl";
    ctrl.dataset.id = menuItemId;
    ctrl.innerHTML = `
      <button class="mic-qty-card-btn mic-qty-card-dec" data-id="${menuItemId}">
        <i class="material-icons">remove</i>
      </button>
      <span class="mic-qty-card-num">${quantity}</span>
      <button class="mic-qty-card-btn mic-qty-card-inc" data-id="${menuItemId}">
        <i class="material-icons">add</i>
      </button>
    `;
    bottom.appendChild(ctrl);
  } else {
    const btn = document.createElement("button");
    btn.className = "mic-add-btn add-to-cart-btn";
    btn.dataset.id = menuItemId;
    btn.dataset.name = menuItemNames[menuItemId] || "";
    btn.innerHTML = `<i class="material-icons" style="font-size:1.15rem;">add</i>`;
    bottom.appendChild(btn);
  }
}

function setupCartDrawer() {
  document.getElementById("openCartBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openCart();
  });
  document.getElementById("cartNavBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openCart();
  });
  document.getElementById("closeCartBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeCartDrawer();
  });
  document.getElementById("cartOverlay")?.addEventListener("click", closeCartDrawer);
  document.getElementById("placeOrderBtn")?.addEventListener("click", handlePlaceOrder);

  document.getElementById("menuContainer")?.addEventListener("click", async (e) => {
    const addBtn = e.target.closest(".add-to-cart-btn");
    const incBtn = e.target.closest(".mic-qty-card-inc");
    const decBtn = e.target.closest(".mic-qty-card-dec");

    if (addBtn) {
      const menuItemId = addBtn.dataset.id;
      const itemName = addBtn.dataset.name;
      if (menuItemId) await handleAddToCart(menuItemId, itemName, addBtn);
    } else if (incBtn) {
      await handleCardQtyChange(incBtn.dataset.id, 1);
    } else if (decBtn) {
      await handleCardQtyChange(decBtn.dataset.id, -1);
    }
  });

  document.getElementById("cartItemsList")?.addEventListener("click", async (e) => {
    const incBtn = e.target.closest(".cart-qty-inc");
    const decBtn = e.target.closest(".cart-qty-dec");
    const removeBtn = e.target.closest(".cart-item-remove");

    if (incBtn) await handleQuantityChange(incBtn.dataset.id, 1);
    if (decBtn) await handleQuantityChange(decBtn.dataset.id, -1);
    if (removeBtn) await handleRemoveItem(removeBtn.dataset.id);
  });
}

function openCart() {
  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartOverlay")?.classList.remove("hide");
  document.body.style.overflow = "hidden";
  refreshCartDrawer();
}

function closeCartDrawer() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.add("hide");
  document.body.style.overflow = "";
}

async function handleAddToCart(menuItemId, itemName, btn) {
  const sessionId = getSessionId();
  if (!sessionId) {
    M.toast({ html: "Please scan the QR code at your table to add items.", classes: "red darken-1" });
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="material-icons" style="font-size:1.15rem;animation:spin 0.6s linear infinite;">autorenew</i>';

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId, quantity: 1 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to add item");

    syncCartState(data.cart);
    updateMenuCardButton(menuItemId, cartState[menuItemId] || 1);
    updateCartBadge(data.cart.itemCount);
    M.toast({ html: `${itemName || "Item"} added to cart`, classes: "teal darken-2" });
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="material-icons" style="font-size:1.15rem;">add</i>';
    M.toast({ html: err.message || "Could not add item", classes: "red darken-1" });
  }
}

async function handleCardQtyChange(menuItemId, delta) {
  const sessionId = getSessionId();
  if (!sessionId) return;

  const currentQty = cartState[menuItemId] || 0;
  const newQty = currentQty + delta;

  if (newQty <= 0) {
    await handleCartItemDelete(menuItemId);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${sessionId}/items/${menuItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not update quantity");

    syncCartState(data.cart);
    updateMenuCardButton(menuItemId, newQty);
    updateCartBadge(data.cart.itemCount);
  } catch (err) {
    M.toast({ html: err.message, classes: "red darken-1" });
  }
}

async function handleCartItemDelete(menuItemId) {
  const sessionId = getSessionId();
  if (!sessionId) return;

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${sessionId}/items/${menuItemId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not remove item");

    syncCartState(data.cart);
    updateMenuCardButton(menuItemId, 0);
    updateCartBadge(data.cart.itemCount);
  } catch (err) {
    M.toast({ html: err.message, classes: "red darken-1" });
  }
}

async function handleQuantityChange(menuItemId, delta) {
  const sessionId = getSessionId();
  if (!sessionId) return;

  const row = document.querySelector(`.cart-item-row[data-id="${menuItemId}"]`);
  const qtyEl = row?.querySelector(".cart-qty-value");
  const currentQty = parseInt(qtyEl?.textContent || "1", 10);
  const newQty = currentQty + delta;

  if (newQty <= 0) {
    await handleRemoveItem(menuItemId);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${sessionId}/items/${menuItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQty }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not update quantity");

    syncCartState(data.cart);
    updateMenuCardButton(menuItemId, newQty);
    renderCartDrawer(data.cart);
    updateCartBadge(data.cart.itemCount);
  } catch (err) {
    M.toast({ html: err.message, classes: "red darken-1" });
  }
}

async function handleRemoveItem(menuItemId) {
  const sessionId = getSessionId();
  if (!sessionId) return;

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${sessionId}/items/${menuItemId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not remove item");

    syncCartState(data.cart);
    updateMenuCardButton(menuItemId, 0);
    renderCartDrawer(data.cart);
    updateCartBadge(data.cart.itemCount);
  } catch (err) {
    M.toast({ html: err.message, classes: "red darken-1" });
  }
}

async function refreshCartDrawer() {
  const sessionId = getSessionId();
  if (!sessionId) {
    renderCartDrawer({ items: [], subtotal: 0, itemCount: 0 });
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/cart/${sessionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    syncCartState(data.cart);
    renderCartDrawer(data.cart);
    updateCartBadge(data.cart.itemCount);
  } catch {
    renderCartDrawer({ items: [], subtotal: 0, itemCount: 0 });
  }
}

async function handlePlaceOrder() {
  const sessionId = getSessionId();
  if (!sessionId) return;

  const btn = document.getElementById("placeOrderBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="material-icons left" style="animation:spin 0.6s linear infinite;">autorenew</i>Placing...';

  try {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not place order");

    // Reset all card buttons back to "+"
    Object.keys(cartState).forEach((id) => updateMenuCardButton(id, 0));
    cartState = {};
    closeCartDrawer();
    updateCartBadge(0);
    showOrderConfirmation(data.order);
  } catch (err) {
    M.toast({ html: err.message || "Order failed. Please try again.", classes: "red darken-1" });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="material-icons left">check_circle</i>Place Order';
  }
}

function renderCartDrawer(cart) {
  const itemsList = document.getElementById("cartItemsList");
  const emptyMsg = document.getElementById("cartEmpty");
  const footer = document.getElementById("cartDrawerFooter");
  const placeOrderBtn = document.getElementById("placeOrderBtn");

  if (!cart.items || cart.items.length === 0) {
    itemsList?.classList.add("hide");
    emptyMsg?.classList.remove("hide");
    footer?.classList.add("hide");
    if (placeOrderBtn) placeOrderBtn.disabled = false;
    return;
  }

  emptyMsg?.classList.add("hide");
  itemsList?.classList.remove("hide");
  footer?.classList.remove("hide");

  const hasUnavailableItems = cart.items.some((item) => item.availabilityStatus !== "available");
  if (placeOrderBtn) {
    placeOrderBtn.disabled = hasUnavailableItems;
  }

  itemsList.innerHTML = `
    ${hasUnavailableItems ? '<div class="cart-unavailable-warning">Remove unavailable items before placing your order.</div>' : ""}
    ${cart.items.map((item) => `
    <div class="cart-item-row ${item.availabilityStatus !== "available" ? "cart-item-row-unavailable" : ""}" data-id="${escapeHtml(String(item.menuItemId))}">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">$${Number(item.price).toFixed(2)} each</div>
        ${renderCartItemAvailability(item)}
      </div>
      <div class="cart-item-controls">
        ${item.availabilityStatus === "available"
          ? `<button class="cart-qty-btn cart-qty-dec" data-id="${escapeHtml(String(item.menuItemId))}">
              <i class="material-icons" style="font-size:1rem;">remove</i>
            </button>`
          : ""}
        <span class="cart-qty-value">${item.quantity}</span>
        ${item.availabilityStatus === "available"
          ? `<button class="cart-qty-btn cart-qty-inc" data-id="${escapeHtml(String(item.menuItemId))}">
              <i class="material-icons" style="font-size:1rem;">add</i>
            </button>`
          : ""}
      </div>
      <div class="cart-item-subtotal">$${(item.price * item.quantity).toFixed(2)}</div>
      <button class="cart-item-remove" data-id="${escapeHtml(String(item.menuItemId))}" title="Remove">
        <i class="material-icons" style="font-size:1.05rem;">delete_outline</i>
      </button>
    </div>
  `).join("")}`;

  const subtotal = cart.subtotal || 0;
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  document.getElementById("cartSubtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("cartTax").textContent = `$${tax.toFixed(2)}`;
  document.getElementById("cartTotal").innerHTML = `<strong>$${total.toFixed(2)}</strong>`;
}

function renderCartItemAvailability(item) {
  if (item.availabilityStatus === "available") return "";

  const label = item.availabilityStatus === "removed"
    ? "Removed from menu"
    : "No longer available";

  return `<div class="cart-item-availability">${label}</div>`;
}

function updateCartBadge(count) {
  const badge = document.getElementById("cartBadge");
  const floatingCount = document.getElementById("floatingCartCount");

  if (count > 0) {
    badge?.classList.remove("hide");
    floatingCount?.classList.remove("hide");
    if (badge) badge.textContent = count;
    if (floatingCount) floatingCount.textContent = count;
  } else {
    badge?.classList.add("hide");
    floatingCount?.classList.add("hide");
  }
}

function showOrderConfirmation(order) {
  const summaryBox = document.getElementById("orderSummaryBox");
  const confirmOrderId = document.getElementById("confirmOrderId");

  if (confirmOrderId) confirmOrderId.textContent = order._id;

  if (summaryBox && order.items) {
    const rows = order.items.map((item) => `
      <div class="order-confirm-row">
        <span>${escapeHtml(item.name)} x${item.quantity}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join("");

    summaryBox.innerHTML = `
      ${rows}
      <div class="order-confirm-divider"></div>
      <div class="order-confirm-row">
        <span>Subtotal</span><span>$${Number(order.subtotal).toFixed(2)}</span>
      </div>
      <div class="order-confirm-row grey-text">
        <span>Tax (10%)</span><span>$${Number(order.tax).toFixed(2)}</span>
      </div>
      <div class="order-confirm-row order-confirm-total">
        <span><strong>Total</strong></span><span><strong>$${Number(order.totalAmount).toFixed(2)}</strong></span>
      </div>
    `;
  }

  const modal = M.Modal.getInstance(document.getElementById("orderConfirmModal"));
  modal?.open();
}
