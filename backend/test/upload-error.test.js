import assert from 'node:assert/strict';
import test from 'node:test';
import { errorHandler } from '../src/middleware/errorMiddleware.js';
import { uploadImages } from '../src/services/uploadService.js';

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('missing image storage configuration is explained to the client', async () => {
  const file = {
    mimetype: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  };
  let uploadError;
  await assert.rejects(
    uploadImages([file], { enabled: false }),
    (error) => {
      uploadError = error;
      return error.statusCode === 503;
    },
  );

  const response = responseRecorder();
  errorHandler(uploadError, {}, response, () => {});

  assert.equal(response.statusCode, 503);
  assert.equal(
    response.payload.message,
    'Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend, then restart it.',
  );
});

test('unexposed service errors remain generic', () => {
  const response = responseRecorder();
  errorHandler(
    Object.assign(new Error('private provider detail'), { statusCode: 503 }),
    {},
    response,
    () => {},
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.payload.message, 'Internal server error');
});

test('Cloudinary failures return a safe diagnostic without provider details', async () => {
  const file = {
    mimetype: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  };
  const uploader = {
    upload_stream: (_options, callback) => ({
      end: () => callback(new Error('private provider secret'), undefined),
    }),
  };
  let uploadError;
  await assert.rejects(
    uploadImages([file], { enabled: true, uploader }),
    (error) => {
      uploadError = error;
      return error.statusCode === 502;
    },
  );

  const response = responseRecorder();
  errorHandler(uploadError, {}, response, () => {});

  assert.equal(response.statusCode, 502);
  assert.equal(
    response.payload.message,
    'Cloudinary could not store the image. Check the backend configuration and retry.',
  );
  assert.doesNotMatch(JSON.stringify(response.payload), /private provider secret/);
});
