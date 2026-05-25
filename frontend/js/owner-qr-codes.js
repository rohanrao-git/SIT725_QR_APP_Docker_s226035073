document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const user = getStoredUser();

  if (!token || !user) {
    window.location.href = "login.html";
    return;
  }

  if (user.role !== "owner") {
    safeToast("Access denied");
    window.location.href = "login.html";
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }

  loadOwnerTables(user);
});

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

async function ownerApiRequest(endpoint) {
  const token = localStorage.getItem("token");

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error("Network error. Please check backend connection.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data || {};
}

async function loadOwnerTables(user) {
  const container = document.getElementById("ownerTablesContainer");
  if (!container) return;

  try {
    const response = await ownerApiRequest("/menu/my/tables");
    const tables = response.tables || [];
    const restaurantId = user.restaurantId || tables[0]?.restaurantId;
    const backendBaseUrl = API_BASE_URL.replace("/api", "");

    if (!tables.length) {
      container.innerHTML = `
        <div class="col s12">
          <div class="card-panel center-align">
            No tables configured yet. Contact your administrator to set up table QR codes.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = tables
      .map((table) => {
        const qrUrl = getQrImageUrl(table.qrCodeUrl);
        const menuLink = restaurantId
          ? `${backendBaseUrl}/menu/${restaurantId}?table=${table.tableNumber}`
          : "";

        return `
          <div class="col s12 m6 l4">
            <div class="card table-qr-card hoverable">
              <div class="card-content center-align">
                <span class="card-title">Table ${escapeHtml(String(table.tableNumber || "-"))}</span>
                <p>Status: ${table.isActive ? "Active" : "Inactive"}</p>
                ${
                  qrUrl
                    ? `<img
                         src="${escapeHtml(qrUrl)}"
                         alt="QR Code for Table ${escapeHtml(String(table.tableNumber))}"
                         class="qr-image"
                         loading="lazy"
                       />`
                    : `<p class="red-text">QR code not available</p>`
                }
                ${
                  menuLink
                    ? `<p class="grey-text" style="font-size:0.85rem;word-break:break-all;">${escapeHtml(menuLink)}</p>`
                    : ""
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="col s12">
        <div class="card-panel red-text center-align">${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

function getQrImageUrl(qrCodeUrl) {
  if (!qrCodeUrl) return "";

  const cleanUrl = String(qrCodeUrl).trim();

  if (cleanUrl.startsWith("data:image")) {
    return cleanUrl;
  }

  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    return cleanUrl;
  }

  const backendBaseUrl = API_BASE_URL.replace("/api", "");
  return cleanUrl.startsWith("/") ? `${backendBaseUrl}${cleanUrl}` : `${backendBaseUrl}/${cleanUrl}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeToast(message) {
  if (window.M?.toast) {
    M.toast({ html: message });
  }
}
