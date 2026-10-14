import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import { normalizePhone } from '../utils/phone.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const fields = {};
  if (req.body.name !== undefined) fields.name = req.body.name.trim();
  if (req.body.phone !== undefined) {
    const phone = req.body.phone.trim();
    fields.phone = phone;
    fields.phoneNormalized = phone ? normalizePhone(phone) : undefined;
  }

  if (fields.phoneNormalized) {
    const existingUser = await User.exists({
      _id: { $ne: user._id },
      phoneNormalized: fields.phoneNormalized,
    });
    const existingCustomer = await Customer.exists({
      user: { $ne: user._id },
      phoneNormalized: fields.phoneNormalized,
    });
    if (existingUser || existingCustomer)
      throw Object.assign(new Error('That phone number is already used by another account'), {
        statusCode: 409,
      });
  }

  Object.assign(user, fields);
  if (req.body.password) {
    if (!req.body.currentPassword)
      throw Object.assign(new Error('Enter your current password to set a new one'), {
        statusCode: 400,
      });
    if (!user.password)
      throw Object.assign(
        new Error('This account has no password yet. Ask the shop administrator to set one.'),
        { statusCode: 400 },
      );
    const valid = await bcrypt.compare(req.body.currentPassword, user.password);
    if (!valid)
      throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
    user.password = await bcrypt.hash(req.body.password, 12);
  }

  try {
    await user.save();
  } catch (error) {
    if (error?.code === 11000)
      throw Object.assign(new Error('That phone number is already used by another account'), {
        statusCode: 409,
      });
    throw error;
  }

  if (user.role === 'CUSTOMER') {
    const customerFields = { name: user.name, phone: user.phone };
    const update = { $set: customerFields };
    if (user.phoneNormalized) customerFields.phoneNormalized = user.phoneNormalized;
    else update.$unset = { phoneNormalized: '' };
    await Customer.updateOne({ user: user._id }, update);
  } else if (user.role === 'TAILOR') {
    await Tailor.updateOne({ user: user._id }, { $set: { name: user.name, phone: user.phone } });
  }

  res.json({ success: true, data: { user: user.toSafeJSON() } });
});
