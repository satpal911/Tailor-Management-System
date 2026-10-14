import Customer from '../models/Customer.js';
import Measurement from '../models/Measurement.js';
import Order from '../models/Order.js';
import Tailor from '../models/Tailor.js';
import { asyncHandler } from '../utils/asyncHandler.js';

async function assertMeasurementAccess(user, measurement) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'CUSTOMER') {
    const customer = await Customer.findOne({ user: user._id }).select('_id');
    if (customer && String(customer._id) === String(measurement.customer)) return;
    throw Object.assign(new Error('Measurement not found'), { statusCode: 404 });
  }
  if (user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: user._id }).select('_id');
    if (
      tailor &&
      (await Order.exists({
        tailor: tailor._id,
        customer: measurement.customer,
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
      }))
    )
      return;
    throw Object.assign(new Error('Measurement not found'), { statusCode: 404 });
  }
  throw Object.assign(new Error('You do not have permission to perform this action'), {
    statusCode: 403,
  });
}

export const updateMeasurement = asyncHandler(async (req, res) => {
  const measurement = await Measurement.findById(req.params.id);
  if (!measurement) throw Object.assign(new Error('Measurement not found'), { statusCode: 404 });
  await assertMeasurementAccess(req.user, measurement);
  for (const key of ['name', 'garmentType', 'unit', 'values', 'customMeasurements', 'notes']) {
    if (req.body[key] !== undefined) measurement[key] = req.body[key];
  }
  await measurement.save();
  res.json({ success: true, data: measurement });
});

export const deleteMeasurement = asyncHandler(async (req, res) => {
  const measurement = await Measurement.findById(req.params.id);
  if (!measurement) throw Object.assign(new Error('Measurement not found'), { statusCode: 404 });
  await assertMeasurementAccess(req.user, measurement);
  if (await Order.exists({ measurement: measurement._id })) {
    throw Object.assign(new Error('This measurement is linked to an order and cannot be deleted'), {
      statusCode: 409,
    });
  }
  await measurement.deleteOne();
  res.json({ success: true, data: { id: String(measurement._id), deleted: true } });
});
