let ownerMenuItems = [];

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

document.addEventListener("DOMContentLoaded", () => {
  try {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    const user = userRaw ? JSON.parse(userRaw) : null;

    if (!token || !user) {
      window.location.href = "login.html";
      return;
    }

    if (user.role !== "owner") {
      safeToast("Access denied");
      window.location.href = "login.html";
      return;
    }

    const ownerWelcome = document.getElementById("ownerWelcome");
    if (ownerWelcome) {
      ownerWelcome.textContent = `Welcome, ${user.name || user.email}`;
    }

    const modals = document.querySelectorAll(".modal");
    if (window.M?.Modal) {
      M.Modal.init(modals);
    }

    const selects = document.querySelectorAll("select");
    if (window.M?.FormSelect) {
      M.FormSelect.init(selects);
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "login.html";
      });
    }

    const addItemBtn = document.getElementById("addItemBtn");
    if (addItemBtn) {
      addItemBtn.addEventListener("click", resetMenuItemForm);
    }

    const searchInput = document.getElementById("ownerMenuSearch");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        try {
          renderOwnerMenu();
          renderCategorySections();
        } catch (error) {
          console.error(error);
          safeToast("Unable to refresh menu view.");
        }
      });
    }

    const imageUrlInput = document.getElementById("itemImage");
    if (imageUrlInput) {
      imageUrlInput.addEventListener("input", updateImagePreview);
    }

    const imageFileInput = document.getElementById("itemImageFile");
    if (imageFileInput) {
      imageFileInput.addEventListener("change", updateImagePreview);
    }

    const categorySelect = document.getElementById("itemCategory");
    if (categorySelect) {
      categorySelect.addEventListener("change", handleCategoryChange);
    }

    const menuItemForm = document.getElementById("menuItemForm");
    if (menuItemForm) {
      menuItemForm.addEventListener("submit", handleMenuItemSubmit);
    }

    loadOwnerMenu();
    initializeAnalytics();
    loadAnalytics();
  } catch (error) {
    console.error(error);
    safeToast("Owner page failed to initialize. Please refresh.");
  }
});

async function ownerApiRequest(endpoint, method = "GET", body = null) {
  const token = localStorage.getItem("token");

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  } catch (error) {
    throw new Error("Network error. Please check backend connection.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data || {};
}

async function ownerFileRequest(endpoint, formData) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Upload failed");
  }

  return data;
}

function getFilteredItems() {
  const searchInput = document.getElementById("ownerMenuSearch");
  const searchText = searchInput ? searchInput.value.toLowerCase().trim() : "";

  return ownerMenuItems.filter((item) => {
    const name = item.name || "";
    const category = normalizeCategory(item.category);
    const dietary = formatDietaryType(item.dietaryType);

    return (
      name.toLowerCase().includes(searchText) ||
      category.toLowerCase().includes(searchText) ||
      dietary.toLowerCase().includes(searchText)
    );
  });
}

async function loadOwnerMenu() {
  const tableBody = document.getElementById("ownerMenuTable");

  try {
    const response = await ownerApiRequest("/menu/my");
    ownerMenuItems = response.menu || [];
    renderOwnerMenu();
    renderCategorySections();
    updateOwnerStats();
  } catch (error) {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="center-align red-text">${escapeHtml(error.message)}</td>
        </tr>
      `;
    }
  }
}

function renderOwnerMenu() {
  const tableBody = document.getElementById("ownerMenuTable");
  if (!tableBody) return;
  const filteredItems = getFilteredItems();

  if (!filteredItems.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="center-align">No menu items found</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredItems
    .map(
      (item) => `
      <tr>
        <td>${renderOwnerItemThumbnail(item)}</td>
        <td>${escapeHtml(item.name || "-")}</td>
        <td>${normalizeCategory(item.category)}</td>
        <td><span class="dietary-badge ${item.dietaryType === "veg" ? "veg" : "non-veg"}">${formatDietaryType(item.dietaryType)}</span></td>
        <td>$${Number(item.price || 0).toFixed(2)}</td>
        <td>
          <span class="badge-status ${item.isAvailable ? "badge-approved" : "badge-disabled"}">
            ${item.isAvailable ? "Available" : "Unavailable"}
          </span>
        </td>
        <td>
          <button class="btn-small teal action-btn" onclick="editMenuItem('${item._id}')">Edit</button>
          <button class="btn-small ${item.isAvailable ? "orange" : "green"} action-btn" onclick="toggleMenuItemAvailability('${item._id}', ${!item.isAvailable})">
            ${item.isAvailable ? "Mark Unavailable" : "Mark Available"}
          </button>
          <button class="btn-small red action-btn" onclick="deleteMenuItem('${item._id}')">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderCategorySections() {
  const container = document.getElementById("menuCategorySections");
  const filteredItems = getFilteredItems();

  if (!container) return;

  container.innerHTML = MENU_CATEGORIES.map((category) => {
    const items = filteredItems.filter((item) => normalizeCategory(item.category) === category);

    return `
      <div class="col s12 m6 l4">
        <div class="card owner-category-card">
          <div class="card-content">
            <span class="card-title">${category} (${items.length})</span>
            ${items.length
              ? items.map((item) => `
                <div class="category-item-row clickable-row" onclick="editMenuItem('${item._id}')">
                  ${renderOwnerItemThumbnail(item)}
                  <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <div class="grey-text text-darken-1">$${Number(item.price || 0).toFixed(2)}</div>
                  </div>
                  <span class="dietary-badge ${item.dietaryType === "veg" ? "veg" : "non-veg"}">${formatDietaryType(item.dietaryType)}</span>
                </div>
              `).join("")
              : '<p class="grey-text">No items in this category</p>'}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderOwnerItemThumbnail(item) {
  if (!item.image) {
    return `
      <div class="owner-menu-thumb owner-menu-thumb-placeholder">
        <i class="material-icons">restaurant</i>
      </div>
    `;
  }

  return `
    <img
      class="owner-menu-thumb"
      src="${escapeHtml(item.image)}"
      alt="${escapeHtml(item.name || "Menu item")}"
      loading="lazy"
    />
  `;
}

function updateOwnerStats() {
  const menuCount = document.getElementById("menuCount");
  const availableCount = document.getElementById("availableCount");
  const unavailableCount = document.getElementById("unavailableCount");

  const available = ownerMenuItems.filter((item) => item.isAvailable).length;
  const unavailable = ownerMenuItems.length - available;

  if (menuCount) menuCount.textContent = ownerMenuItems.length;
  if (availableCount) availableCount.textContent = available;
  if (unavailableCount) unavailableCount.textContent = unavailable;
}

function resetMenuItemForm() {
  try {
    const form = document.getElementById("menuItemForm");
    if (!form) return;
    form.reset();

    document.getElementById("menuItemId").value = "";
    document.getElementById("itemImage").value = "";
    document.getElementById("itemImageFileId").value = "";
    document.getElementById("menuModalHeading").textContent = "Add Menu Item";
    document.getElementById("itemAvailable").checked = true;

    setSelectValue("itemCategory", "");
    setSelectValue("itemDietaryType", "");
    setDietaryRequired(true);
    updateImagePreview();

    if (window.M?.updateTextFields) {
      M.updateTextFields();
    }
  } catch (error) {
    console.error(error);
    safeToast("Unable to reset form.");
  }
}

function editMenuItem(itemId) {
  const item = ownerMenuItems.find((menuItem) => menuItem._id === itemId);
  if (!item) return;

  document.getElementById("menuItemId").value = item._id;
  document.getElementById("itemName").value = item.name || "";
  document.getElementById("itemDescription").value = item.description || "";
  document.getElementById("itemPrice").value = item.price;
  document.getElementById("itemImage").value = item.image || "";
  document.getElementById("itemImageFileId").value = item.imageFileId || "";
  document.getElementById("itemImageFile").value = "";
  document.getElementById("itemAvailable").checked = !!item.isAvailable;

  setSelectValue("itemCategory", normalizeCategory(item.category));
  setSelectValue("itemDietaryType", item.dietaryType === "veg" ? "veg" : "non_veg");
  handleCategoryChange();

  document.getElementById("menuModalHeading").textContent = "Edit Menu Item";
  updateImagePreview();
  if (window.M?.updateTextFields) {
    M.updateTextFields();
  }

  const modalElement = document.getElementById("menuItemModal");
  const modalInstance = window.M?.Modal ? M.Modal.getInstance(modalElement) : null;
  if (modalInstance) {
    modalInstance.open();
  } else {
    safeToast("Modal could not be opened.");
  }
}

async function handleMenuItemSubmit(event) {
  event.preventDefault();
  const form = document.getElementById("menuItemForm");
  handleCategoryChange();
  if (!form.reportValidity()) {
    return;
  }

  const itemId = document.getElementById("menuItemId").value;
  const name = document.getElementById("itemName").value.trim();
  const category = document.getElementById("itemCategory").value;
  const dietaryType = document.getElementById("itemDietaryType").value;
  const description = document.getElementById("itemDescription").value.trim();
  const priceRaw = document.getElementById("itemPrice").value;
  const imageInput = document.getElementById("itemImage");
  const imageFileIdInput = document.getElementById("itemImageFileId");
  let image = imageInput.value.trim();
  let imageFileId = imageFileIdInput.value.trim();

  const price = Number(priceRaw);
  if (Number.isNaN(price) || price < 0) {
    M.toast({ html: "Please enter a valid price." });
    return;
  }

  try {
    const imageFile = document.getElementById("itemImageFile").files[0];
    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      const upload = await ownerFileRequest("/menu/my/images", formData);
      image = upload.imageUrl;
      imageFileId = upload.imageFileId;
      imageInput.value = image;
      imageFileIdInput.value = imageFileId;
    }

    const payload = {
      name,
      category: normalizeCategory(category),
      dietaryType: dietaryType || undefined,
      description,
      price,
      image,
      imageFileId: imageFileId || undefined,
      isAvailable: document.getElementById("itemAvailable").checked,
    };

    if (itemId) {
      await ownerApiRequest(`/menu/my/${itemId}`, "PUT", payload);
      M.toast({ html: "Menu item updated" });
    } else {
      await ownerApiRequest("/menu/my", "POST", payload);
      M.toast({ html: "Menu item created" });
    }

    const modalElement = document.getElementById("menuItemModal");
    const modalInstance = window.M?.Modal ? M.Modal.getInstance(modalElement) : null;
    if (modalInstance) {
      modalInstance.close();
    }

    await loadOwnerMenu();
  } catch (error) {
    M.toast({ html: error.message });
  }
}

async function toggleMenuItemAvailability(itemId, isAvailable) {
  try {
    await ownerApiRequest(`/menu/my/${itemId}/availability`, "PATCH", { isAvailable });
    M.toast({ html: "Availability updated" });
    await loadOwnerMenu();
  } catch (error) {
    M.toast({ html: error.message });
  }
}

async function deleteMenuItem(itemId) {
  const confirmed = confirm("Delete this menu item?");
  if (!confirmed) return;

  try {
    await ownerApiRequest(`/menu/my/${itemId}`, "DELETE");
    M.toast({ html: "Menu item deleted" });
    await loadOwnerMenu();
  } catch (error) {
    M.toast({ html: error.message });
  }
}

function initializeAnalytics() {
  const fromDateInput = document.getElementById("analyticsFromDate");
  const toDateInput = document.getElementById("analyticsToDate");
  const refreshBtn = document.getElementById("refreshAnalyticsBtn");

  // Set default date range (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (fromDateInput) {
    fromDateInput.value = formatDateForInput(thirtyDaysAgo);
    fromDateInput.addEventListener("change", loadAnalytics);
  }

  if (toDateInput) {
    toDateInput.value = formatDateForInput(today);
    toDateInput.addEventListener("change", loadAnalytics);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAnalytics);
  }
}

async function loadAnalytics() {
  const fromDateInput = document.getElementById("analyticsFromDate");
  const toDateInput = document.getElementById("analyticsToDate");

  const from = fromDateInput ? fromDateInput.value : null;
  const to = toDateInput ? toDateInput.value : null;

  const queryParams = new URLSearchParams();
  if (from) queryParams.append("from", from);
  if (to) queryParams.append("to", to);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";

  const [summaryResult, peakResult, forecastResult] = await Promise.allSettled([
    ownerApiRequest(`/analytics/my/summary${query}`),
    ownerApiRequest(`/analytics/my/peak-hours${query}`),
    ownerApiRequest(`/analytics/my/item-forecast${query}`),
  ]);

  if (summaryResult.status === "fulfilled") {
    displayAnalytics(summaryResult.value.summary);
  } else {
    displayAnalyticsError(summaryResult.reason.message);
  }

  if (peakResult.status === "fulfilled") {
    displayPeakHours(peakResult.value.peakHours);
  } else {
    displayPeakHoursError();
  }

  if (forecastResult.status === "fulfilled") {
    displayForecast(forecastResult.value.forecast);
  } else {
    displayForecastError();
  }
}

function displayAnalytics(summary) {
  const totalOrdersEl = document.getElementById("analyticsTotalOrders");
  const totalRevenueEl = document.getElementById("analyticsTotalRevenue");
  const topItemEl = document.getElementById("analyticsTopItem");
  const busiestTableEl = document.getElementById("analyticsBusiestTable");

  if (totalOrdersEl) {
    totalOrdersEl.textContent = summary.totalOrders || 0;
  }

  if (totalRevenueEl) {
    totalRevenueEl.textContent = formatCurrency(summary.totalRevenue || 0);
  }

  if (topItemEl) {
    topItemEl.textContent = summary.topItem || "N/A";
  }

  if (busiestTableEl) {
    busiestTableEl.textContent = summary.busiestTable ? `Table ${summary.busiestTable}` : "N/A";
  }
}

function displayAnalyticsError(errorMessage) {
  const totalOrdersEl = document.getElementById("analyticsTotalOrders");
  const totalRevenueEl = document.getElementById("analyticsTotalRevenue");
  const topItemEl = document.getElementById("analyticsTopItem");
  const busiestTableEl = document.getElementById("analyticsBusiestTable");

  const errorText = "Error";

  if (totalOrdersEl) totalOrdersEl.textContent = errorText;
  if (totalRevenueEl) totalRevenueEl.textContent = errorText;
  if (topItemEl) topItemEl.textContent = errorText;
  if (busiestTableEl) busiestTableEl.textContent = errorText;

  M.toast({ html: `Failed to load analytics: ${errorMessage}` });
}

function displayPeakHours(payload) {
  const tableBody = document.getElementById("analyticsPeakHoursTable");
  if (!tableBody) return;

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const peakHoursByDay = payload.peakHoursByDay || {};
  const rows = dayOrder
    .filter((day) => peakHoursByDay[day])
    .map((day) => {
      const item = peakHoursByDay[day];
      const hoursText = (item.peakHours || []).map(formatHourLabel).join(", ") || "N/A";
      return `
        <tr>
          <td>${day}</td>
          <td>${hoursText}</td>
          <td>${item.confidence || "N/A"}</td>
        </tr>
      `;
    });

  tableBody.innerHTML = rows.length
    ? rows.join("")
    : '<tr><td colspan="3" class="center-align">No peak-hour data available</td></tr>';
}

function displayPeakHoursError() {
  const tableBody = document.getElementById("analyticsPeakHoursTable");
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="3" class="center-align red-text">Unable to load peak hours</td></tr>';
}

function displayForecast(payload) {
  const tableBody = document.getElementById("analyticsForecastTable");
  if (!tableBody) return;

  const items = (payload.forecastedItems || []).slice(0, 7);
  tableBody.innerHTML = items.length
    ? items.map((item) => {
      const trendText = formatTrend(item.trend, item.trendPercentage);
      return `
          <tr>
            <td>${item.itemName}</td>
            <td><span class="analytics-trend ${item.trend || "stable"}">${trendText}</span></td>
            <td>${Number(item.forecast || 0).toFixed(2)}</td>
          </tr>
        `;
    }).join("")
    : '<tr><td colspan="3" class="center-align">No forecast data available</td></tr>';
}

function displayForecastError() {
  const tableBody = document.getElementById("analyticsForecastTable");
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="3" class="center-align red-text">Unable to load forecast</td></tr>';
}

function formatHourLabel(hour) {
  const nextHour = (hour + 1) % 24;
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String(nextHour).padStart(2, "0")}:00`;
  return `${start}-${end}`;
}

function formatTrend(trend, percentage) {
  if (trend === "up") return `Up ${percentage || 0}%`;
  if (trend === "down") return `Down ${percentage || 0}%`;
  return "Stable";
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function normalizeCategory(category) {
  const normalized = CATEGORY_ALIASES[String(category || "").trim().toLowerCase()];
  return normalized || "Mains";
}

function formatDietaryType(type) {
  return type === "veg" ? "Veg" : "Non-Veg";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setSelectValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.value = value;
  if (window.M?.FormSelect) {
    M.FormSelect.init(select);
  }
}

function updateImagePreview() {
  const fileInput = document.getElementById("itemImageFile");
  const imageInput = document.getElementById("itemImage");
  const imageEl = document.getElementById("itemImagePreview");
  const wrapEl = document.getElementById("itemImagePreviewWrap");
  if (!imageInput || !imageEl || !wrapEl) return;

  const selectedFile = fileInput?.files?.[0];
  if (selectedFile) {
    imageEl.src = URL.createObjectURL(selectedFile);
    wrapEl.classList.remove("hide");
    imageEl.onerror = () => {
      wrapEl.classList.add("hide");
    };
    return;
  }

  const imageUrl = imageInput.value.trim();

  if (!imageUrl) {
    wrapEl.classList.add("hide");
    imageEl.removeAttribute("src");
    return;
  }

  imageEl.src = imageUrl;
  wrapEl.classList.remove("hide");
  imageEl.onerror = () => {
    wrapEl.classList.add("hide");
  };
}

function handleCategoryChange() {
  const categorySelect = document.getElementById("itemCategory");
  const dietarySelect = document.getElementById("itemDietaryType");
  const dietaryFieldWrap = document.getElementById("dietaryFieldWrap");
  if (!categorySelect || !dietarySelect) return;

  const category = categorySelect.value;
  const isBeverage = category === "Beverages";

  setDietaryRequired(!isBeverage);

  if (isBeverage) {
    setSelectValue("itemDietaryType", "");
    if (dietaryFieldWrap) dietaryFieldWrap.classList.add("hide");
  } else {
    if (dietaryFieldWrap) dietaryFieldWrap.classList.remove("hide");
  }

  dietarySelect.setCustomValidity("");
}

function setDietaryRequired(required) {
  const dietarySelect = document.getElementById("itemDietaryType");
  if (!dietarySelect) return;
  dietarySelect.required = required;
}

function safeToast(message) {
  if (window.M?.toast) {
    M.toast({ html: message });
  } else {
    console.warn(message);
  }
}
