const mongoose = require('mongoose');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  let { message } = err;

  // Mongoose schema validation failure (e.g. required field missing, wrong type)
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // Mongoose cast failure (e.g. non-ObjectId string passed to an ObjectId field)
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field '${err.path}'`;
  }

  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image file must be 5MB or smaller'
      : err.message;
  }

  const body = {
    success: false,
    message: statusCode >= 500 ? 'Internal server error' : message,
  };

  if (err.code) {
    body.code = err.code;
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json(body);
}

module.exports = { errorHandler };
