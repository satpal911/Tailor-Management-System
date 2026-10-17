import { cloudinaryEnabled, default as cloudinary } from '../config/cloudinary.js';
function verifyImage(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === 'image/png')
    return b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/webp')
    return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
export async function uploadImages(
  files,
  { enabled = cloudinaryEnabled, uploader = cloudinary.uploader } = {},
) {
  if (!files?.length) return [];
  if (files.some((file) => !verifyImage(file)))
    throw Object.assign(new Error('Image file contents do not match a supported image type'), {
      statusCode: 400,
    });
  if (!enabled)
    throw Object.assign(
      new Error(
        'Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend, then restart it.',
      ),
      { statusCode: 503, expose: true },
    );
  const results = await Promise.allSettled(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const stream = uploader.upload_stream(
            {
              folder: 'tailor-management/designs',
              resource_type: 'image',
              allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            },
            (err, result) => {
              if (err) return reject(err);
              if (!result?.secure_url || !result?.public_id)
                return reject(new Error('Cloudinary returned an incomplete upload result'));
              resolve({ url: result.secure_url, publicId: result.public_id });
            },
          );
          stream.end(file.buffer);
        }),
    ),
  );
  const uploaded = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    await Promise.allSettled(uploaded.map((image) => uploader.destroy(image.publicId)));
    throw Object.assign(
      new Error('Cloudinary could not store the image. Check the backend configuration and retry.'),
      { statusCode: 502, expose: true },
    );
  }
  return uploaded;
}

export async function deleteUploadedImages(images, { uploader = cloudinary.uploader } = {}) {
  const publicIds = (images || []).map((image) => image?.publicId).filter(Boolean);
  await Promise.allSettled(publicIds.map((publicId) => uploader.destroy(publicId)));
}
