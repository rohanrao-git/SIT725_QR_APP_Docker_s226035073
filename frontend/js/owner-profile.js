document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !user || user.role !== "owner") {
    window.location.href = "login.html";
    return;
  }

  setupLogout();
  setupPersonalInfoSection();
  setupPasswordSection();
  setupRestaurantSection();

  await Promise.all([loadProfile(), loadRestaurant()]);
});

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function apiRequest(method, endpoint, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE_URL}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function setupLogout() {
  const doLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
  };
  document.getElementById("logoutBtn")?.addEventListener("click", doLogout);
  document.getElementById("logoutBtnCard")?.addEventListener("click", doLogout);
}

async function loadProfile() {
  try {
    const data = await apiRequest("GET", "/auth/me");
    displayProfile(data.user);
  } catch (err) {
    M.toast({ html: `Failed to load profile: ${err.message}`, classes: "red darken-1" });
  }
}

function displayProfile(user) {
  const initial = (user.name || user.email || "?")[0].toUpperCase();
  setTextById("profileAvatar", initial);
  setTextById("bannerName", user.name || "–");
  setTextById("bannerEmail", user.email || "–");
  setTextById("profileSubtitle", user.email || "");
  setTextById("viewName", user.name || "–");
  setTextById("viewEmail", user.email || "–");

  const stored = JSON.parse(localStorage.getItem("user") || "{}");
  localStorage.setItem("user", JSON.stringify({ ...stored, ...user }));
}

function setupPersonalInfoSection() {
  const viewEl = document.getElementById("profileInfoView");
  const formEl = document.getElementById("profileInfoForm");
  const editBtn = document.getElementById("editInfoBtn");
  const cancelBtn = document.getElementById("cancelInfoBtn");
  const saveBtn = document.getElementById("saveInfoBtn");
  const actionsEl = document.getElementById("profileInfoActions");
  const errorEl = document.getElementById("profileInfoError");

  editBtn?.addEventListener("click", () => {
    const name = document.getElementById("viewName").textContent;
    const email = document.getElementById("viewEmail").textContent;
    document.getElementById("profileName").value = name !== "–" ? name : "";
    document.getElementById("profileEmail").value = email !== "–" ? email : "";
    viewEl.classList.add("hide");
    formEl.classList.remove("hide");
    editBtn.classList.add("hide");
    actionsEl.classList.remove("hide");
    hideError(errorEl);
    M.updateTextFields();
  });

  cancelBtn?.addEventListener("click", () => {
    formEl.classList.add("hide");
    viewEl.classList.remove("hide");
    editBtn.classList.remove("hide");
    actionsEl.classList.add("hide");
    hideError(errorEl);
  });

  saveBtn?.addEventListener("click", async () => {
    const name = document.getElementById("profileName").value.trim();
    const email = document.getElementById("profileEmail").value.trim();

    if (!name || !email) {
      showError(errorEl, "Name and email are required.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>Saving…';

    try {
      const data = await apiRequest("PUT", "/auth/me", { name, email });
      displayProfile(data.user);
      cancelBtn.click();
      M.toast({ html: "Profile updated successfully", classes: "teal darken-2" });
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="material-icons left">save</i>Save';
    }
  });
}

function setupPasswordSection() {
  const saveBtn = document.getElementById("savePasswordBtn");
  const errorEl = document.getElementById("passwordError");

  saveBtn?.addEventListener("click", async () => {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    hideError(errorEl);

    if (!currentPassword || !newPassword || !confirmPassword) {
      showError(errorEl, "All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      showError(errorEl, "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError(errorEl, "New passwords do not match.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>Updating…';

    try {
      await apiRequest("PUT", "/auth/me/password", { currentPassword, newPassword });
      document.getElementById("passwordForm").reset();
      M.updateTextFields();
      M.toast({ html: "Password updated successfully", classes: "teal darken-2" });
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="material-icons left">lock_reset</i>Update Password';
    }
  });
}

async function loadRestaurant() {
  try {
    const data = await apiRequest("GET", "/restaurants/my");
    displayRestaurant(data.restaurant);
  } catch (err) {
    setTextById("viewRestaurantName", "Not linked yet");
    M.toast({ html: `Could not load restaurant: ${err.message}`, classes: "orange darken-2" });
  }
}

function displayRestaurant(r) {
  setTextById("viewRestaurantName", r.name || "–");
  setTextById("viewRestaurantAddress", r.address || "–");
  setTextById("viewRestaurantPhone", r.phone || "–");
  setTextById("viewRestaurantEmail", r.email || "–");
  setTextById("viewTotalTables", r.totalTables != null ? `${r.totalTables} tables` : "–");
}

function setupRestaurantSection() {
  const viewEl = document.getElementById("restaurantInfoView");
  const formEl = document.getElementById("restaurantInfoForm");
  const editBtn = document.getElementById("editRestaurantBtn");
  const cancelBtn = document.getElementById("cancelRestaurantBtn");
  const saveBtn = document.getElementById("saveRestaurantBtn");
  const actionsEl = document.getElementById("restaurantInfoActions");
  const errorEl = document.getElementById("restaurantInfoError");

  editBtn?.addEventListener("click", () => {
    document.getElementById("restaurantName").value = textOf("viewRestaurantName");
    document.getElementById("restaurantAddress").value = textOf("viewRestaurantAddress");
    document.getElementById("restaurantPhone").value = textOf("viewRestaurantPhone", "–", "");
    document.getElementById("restaurantEmail").value = textOf("viewRestaurantEmail", "–", "");
    viewEl.classList.add("hide");
    formEl.classList.remove("hide");
    editBtn.classList.add("hide");
    actionsEl.classList.remove("hide");
    hideError(errorEl);
    M.updateTextFields();
  });

  cancelBtn?.addEventListener("click", () => {
    formEl.classList.add("hide");
    viewEl.classList.remove("hide");
    editBtn.classList.remove("hide");
    actionsEl.classList.add("hide");
    hideError(errorEl);
  });

  saveBtn?.addEventListener("click", async () => {
    const name = document.getElementById("restaurantName").value.trim();
    const address = document.getElementById("restaurantAddress").value.trim();
    const phone = document.getElementById("restaurantPhone").value.trim();
    const email = document.getElementById("restaurantEmail").value.trim();

    if (!name || !address) {
      showError(errorEl, "Restaurant name and address are required.");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>Saving…';

    try {
      const data = await apiRequest("PUT", "/restaurants/my", { name, address, phone, email });
      displayRestaurant(data.restaurant);
      cancelBtn.click();
      M.toast({ html: "Restaurant info updated", classes: "teal darken-2" });
    } catch (err) {
      showError(errorEl, err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="material-icons left">save</i>Save';
    }
  });
}

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function textOf(id, placeholder = "–", fallback = "–") {
  const val = document.getElementById(id)?.textContent || "";
  return val === placeholder ? fallback : val;
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hide");
}

function hideError(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hide");
}
