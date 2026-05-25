let foodItemsPieChart = null;

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshAnalyticsBtn");

  setDefaultDates();
  loadAnalytics();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadAnalytics);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    });
  }
});

function getToken() {
  return localStorage.getItem("token");
}

function getDateQuery() {
  const from = document.getElementById("analyticsFromDate").value;
  const to = document.getElementById("analyticsToDate").value;

  const params = new URLSearchParams();

  if (from) params.append("from", from);
  if (to) params.append("to", to);

  return params.toString();
}

function setDefaultDates() {
  const to = new Date();
  const from = new Date();

  from.setDate(to.getDate() - 30);

  document.getElementById("analyticsToDate").value = to.toISOString().slice(0, 10);
  document.getElementById("analyticsFromDate").value = from.toISOString().slice(0, 10);
}

async function analyticsRequest(endpoint) {
  const token = getToken();

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Failed to load analytics");
  }

  return data;
}

async function loadAnalytics() {
  const message = document.getElementById("analyticsMessage");
  const query = getDateQuery();

  message.textContent = "Loading analytics...";
  message.className = "center-align grey-text";

  try {
    const [summaryData, peakHoursData, forecastData] = await Promise.all([
      analyticsRequest(`/analytics/my/summary?${query}`),
      analyticsRequest(`/analytics/my/peak-hours?${query}`),
      analyticsRequest(`/analytics/my/item-forecast?${query}`)
    ]);
    renderSummary(summaryData.summary);
    renderPeakHours(peakHoursData.peakHours);
    renderFoodItemsPieChart(forecastData.forecast || forecastData);

    message.textContent = "Analytics loaded successfully.";
    message.className = "center-align green-text text-darken-2";
  } catch (error) {
    message.textContent = error.message || "Failed to load analytics.";
    message.className = "center-align red-text text-darken-2";

    renderSummary(null);
    renderPeakHours(null);
    renderFoodItemsPieChart(null);
  }
}

function renderSummary(summary) {
  document.getElementById("analyticsTotalOrders").textContent =
    summary?.totalOrders ?? 0;

  document.getElementById("analyticsTotalRevenue").textContent =
    `$${Number(summary?.totalRevenue || 0).toFixed(2)}`;

  document.getElementById("analyticsTopItem").textContent =
    summary?.topItem || "No data";

  document.getElementById("analyticsBusiestTable").textContent =
    summary?.busiestTable ? `Table ${summary.busiestTable}` : "No data";
}

function renderPeakHours(peakHours) {
  const tbody = document.getElementById("analyticsPeakHoursTable");

  if (
    !peakHours ||
    !peakHours.peakHoursByDay ||
    Object.keys(peakHours.peakHoursByDay).length === 0
  ) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="center-align">No peak hour data available</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = Object.entries(peakHours.peakHoursByDay)
    .map(([day, data]) => {
      const hours = data.peakHours && data.peakHours.length
        ? data.peakHours.map(formatHourLabel).join(", ")
        : "No data";

      return `
        <tr>
          <td>${day}</td>
          <td>${hours}</td>
          <td>${data.confidence || "Low"}</td>
        </tr>
      `;
    })
    .join("");
}

function formatHourLabel(hour) {
  const startHour = String(hour).padStart(2, "0");
  const endHour = String((hour + 1) % 24).padStart(2, "0");
  return `${startHour}:00-${endHour}:00`;
}

function renderFoodItemsPieChart(forecast) {
  const canvas = document.getElementById("foodItemsPieChart");
  const noData = document.getElementById("foodItemsNoData");

  if (!canvas) return;

  const items =
    forecast?.forecastedItems ||
    forecast?.items ||
    forecast?.itemQuantities ||
    forecast?.topItems ||
    forecast?.orderedItems ||
    [];

  const validItems = items.filter(item => {
    const quantity =
      item.totalQuantity ||
      item.quantity ||
      item.orderCount ||
      item.forecastQuantity ||
      item.forecast ||
      0;

    return quantity > 0;
  });

  if (validItems.length === 0) {
    if (foodItemsPieChart) {
      foodItemsPieChart.destroy();
      foodItemsPieChart = null;
    }

    if (noData) noData.style.display = "block";
    canvas.style.display = "none";
    return;
  }

  if (noData) noData.style.display = "none";
  canvas.style.display = "block";

  const labels = validItems.map(item =>
    item.itemName || item.name || item.menuItemName || "Unknown Item"
  );

  const data = validItems.map(item =>
    item.totalQuantity ||
    item.quantity ||
    item.orderCount ||
    item.forecastQuantity ||
    item.forecast ||
    0
  );

  if (foodItemsPieChart) {
    foodItemsPieChart.destroy();
  }

  foodItemsPieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Quantity Ordered",
          data,
          backgroundColor: [
            "#26a69a",
            "#ff7043",
            "#42a5f5",
            "#ab47bc",
            "#ffca28",
            "#66bb6a",
            "#ef5350",
            "#5c6bc0",
            "#8d6e63",
            "#78909c"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw} ordered`;
            }
          }
        }
      }
    }
  });
}