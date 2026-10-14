import multer from 'multer';
const configuredMax = Number(process.env.UPLOAD_MAX_MB || 5);
const max =
  (Number.isFinite(configuredMax) && configuredMax >= 1 && configuredMax <= 20
    ? configuredMax
    : 5) *
  1024 *
  1024;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: max, files: 5 },
  fileFilter(_req, file, cb) {
    if (!allowed.has(file.mimetype))
      return cb(
        Object.assign(new Error('Only JPG, PNG, and WEBP images are allowed'), { statusCode: 400 }),
      );
    cb(null, true);
  },
});
