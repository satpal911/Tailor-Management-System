import { validationResult } from 'express-validator';
export function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty())
    return res.status(400).json({
      success: false,
      message: 'Please check the submitted fields',
      errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  next();
}
