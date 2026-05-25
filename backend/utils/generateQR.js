const QRCode = require('qrcode');
const AppError = require('./AppError');

async function generateQR(restaurantId, tableNumber) {
  if (!process.env.BASE_URL || !process.env.BASE_URL.trim()) {
    throw new AppError('BASE_URL is not configured', 500, 'BASE_URL_MISSING');
  }
  const menuUrl = `${process.env.BASE_URL}/menu/${restaurantId}?table=${tableNumber}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(menuUrl);
    return qrDataUrl;
  } catch {
    throw new AppError('Failed to generate QR code', 500, 'QR_GENERATION_FAILED');
  }
}

module.exports = generateQR;

