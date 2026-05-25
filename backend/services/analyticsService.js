const mongoose = require('mongoose');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');

function parseDateRange(from, to) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end);
  if (from) {
    start.setUTCHours(0, 0, 0, 0);
  } else {
    start.setUTCDate(start.getUTCDate() - 30);
    start.setUTCHours(0, 0, 0, 0);
  }
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

async function getSummaryForRestaurant(restaurantId, from, to) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID');
  }

  const { start, end } = parseDateRange(from, to);

  const orders = await Order.find({
    restaurantId,
    createdAt: { $gte: start, $lte: end },
  });

  if (!orders.length) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      topItem: null,
      busiestTable: null,
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }

  const itemCounts = {};
  const tableCounts = {};
  let totalRevenue = 0;

  orders.forEach((order) => {
    totalRevenue += order.totalAmount || 0;
    if (order.tableNumber != null) {
      tableCounts[order.tableNumber] = (tableCounts[order.tableNumber] || 0) + 1;
    }
    (order.items || []).forEach((item) => {
      const key = item.name || 'Unknown';
      itemCounts[key] = (itemCounts[key] || 0) + (item.quantity || 0);
    });
  });

  let topItem = null;
  let topCount = 0;
  Object.entries(itemCounts).forEach(([name, count]) => {
    if (count > topCount) {
      topCount = count;
      topItem = name;
    }
  });

  let busiestTable = null;
  let busiestCount = 0;
  Object.entries(tableCounts).forEach(([table, count]) => {
    if (count > busiestCount) {
      busiestCount = count;
      busiestTable = Number(table);
    }
  });

  return {
    totalOrders: orders.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    topItem,
    busiestTable,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

async function getPeakHours(restaurantId, days = 30) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID');
  }

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  const orders = await Order.find({
    restaurantId,
    createdAt: { $gte: startDate },
  });

  if (!orders.length) {
    return {
      peakHoursByDay: {},
      message: 'Insufficient data for peak hours analysis',
    };
  }

  const hourlyData = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const dayOfWeek = dayNames[orderDate.getDay()];
    const hour = orderDate.getHours();
    if (!hourlyData[dayOfWeek]) {
      hourlyData[dayOfWeek] = Array(24).fill(0);
    }
    hourlyData[dayOfWeek][hour] += 1;
  });

  const peakHoursByDay = {};

  dayNames.forEach((day) => {
    const hourCounts = hourlyData[day];
    if (!hourCounts) return;

    const totalOrdersForDay = hourCounts.reduce((sum, count) => sum + count, 0);
    if (totalOrdersForDay === 0) return;

    const activeHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.hour - b.hour);

    const topHours = activeHours.slice(0, 3).map((entry) => entry.hour);
    const busiestHourCount = activeHours[0]?.count || 0;
    let confidence = 'Low';

    if (totalOrdersForDay >= 10 && busiestHourCount >= 3) {
      confidence = 'High';
    } else if (totalOrdersForDay >= 4 || busiestHourCount >= 2) {
      confidence = 'Medium';
    }

    peakHoursByDay[day] = {
      peakHours: topHours,
      confidence,
      totalOrders: totalOrdersForDay,
    };
  });

  return {
    peakHoursByDay,
    analysisWindow: `Last ${days} days`,
    message: Object.keys(peakHoursByDay).length
      ? undefined
      : 'Insufficient data for peak hours analysis',
  };
}

async function getItemSalesForecast(restaurantId, days = 30) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new AppError('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID');
  }

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  const orders = await Order.find({
    restaurantId,
    createdAt: { $gte: startDate },
  });

  if (!orders.length) {
    return {
      forecastedItems: [],
      message: 'No orders found for this period',
      analysisWindow: `Last ${days} days`,
      generatedAt: new Date().toISOString(),
    };
  }

  const itemTotals = {};

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const itemName =
        item.name ||
        item.itemName ||
        item.menuItemName ||
        'Unknown Item';

      const quantity = Number(item.quantity || 1);

      if (!itemTotals[itemName]) {
        itemTotals[itemName] = {
          itemName,
          totalQuantity: 0,
          orderCount: 0,
        };
      }

      itemTotals[itemName].totalQuantity += quantity;
      itemTotals[itemName].orderCount += 1;
    });
  });

  const forecastedItems = Object.values(itemTotals)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10)
    .map((item) => ({
      itemName: item.itemName,
      totalQuantity: item.totalQuantity,
      orderCount: item.orderCount,
      forecast: item.totalQuantity,
      trend: 'stable',
      trendPercentage: 0,
    }));

  return {
    forecastedItems,
    analysisWindow: `Last ${days} days`,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getSummaryForRestaurant,
  getPeakHours,
  getItemSalesForecast,
};
