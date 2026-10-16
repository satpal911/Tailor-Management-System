export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((error) => error.message)
      .join(', ');
  }
  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid record identifier';
  }
  if (err.name === 'VersionError') {
    status = 409;
    message = 'This record changed during the request. Please retry.';
  }
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body contains invalid JSON';
  }
  if (err.code === 11000) {
    status = 409;
    if (err.keyPattern?.email) message = 'An account already uses this email address.';
    else if (err.keyPattern?.phoneNormalized)
      message = 'An account already uses this phone number.';
    else message = 'A record with that value already exists';
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired session';
  }
  if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. Please upload a smaller image.'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'You can upload up to 5 images.'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Invalid image upload field. Use the images field.'
            : 'Please upload a valid image.';
  }
  if (status >= 500 && status !== 503 && process.env.NODE_ENV !== 'production') {
    console.error('Unhandled API error:', err.name || 'Error', 'code:', err.code || 'none');
  }
  if (status >= 500 && !err.expose) message = 'Internal server error';
  res.status(status).json({
    success: false,
    message,
    ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
}
