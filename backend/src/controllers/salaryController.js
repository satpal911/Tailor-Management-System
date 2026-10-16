import User from '../models/User.js';
import Salary from '../models/Salary.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../services/auditService.js';
import { notifyUser, pushNotification } from '../services/notificationService.js';

const safeFields = ['baseSalary', 'bonuses', 'overtime', 'deductions', 'advance', 'notes'];

export const listSalaries = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'TAILOR') filter.employee = req.user._id;
  else {
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.month) filter.month = Number(req.query.month);
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  }
  const rows = await Salary.find(filter)
    .populate('employee', 'name phone role')
    .sort({ year: -1, month: -1 })
    .limit(200);
  res.json({ success: true, data: rows });
});

export const createSalary = asyncHandler(async (req, res) => {
  const employee = await User.findOne({
    _id: req.body.employee,
    role: { $in: ['TAILOR', 'ADMIN'] },
    accountStatus: 'ACTIVE',
    isActive: true,
  }).select('_id defaultBaseSalary');
  if (!employee)
    throw Object.assign(new Error('Active staff employee not found'), { statusCode: 404 });
  const baseSalary = req.body.baseSalary ?? employee.defaultBaseSalary;
  if (baseSalary === null || baseSalary === undefined)
    throw Object.assign(new Error('Set a base salary before creating a salary record'), {
      statusCode: 400,
    });
  const row = await Salary.create({
    employee: employee._id,
    month: req.body.month,
    year: req.body.year,
    baseSalary,
    bonuses: req.body.bonuses || 0,
    overtime: req.body.overtime || 0,
    deductions: req.body.deductions || 0,
    advance: req.body.advance || 0,
    notes: req.body.notes || '',
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  if (employee.defaultBaseSalary === null || employee.defaultBaseSalary === undefined) {
    await User.updateOne({ _id: employee._id }, { $set: { defaultBaseSalary: baseSalary } });
  }
  await audit(
    req.user._id,
    'CREATE',
    'Salary',
    row._id,
    { employee: employee._id, month: row.month, year: row.year },
    req.ip,
  );
  res.status(201).json({ success: true, data: await row.populate('employee', 'name phone role') });
});

export const setBaseSalary = asyncHandler(async (req, res) => {
  const employeeId = req.user.role === 'TAILOR' ? req.user._id : req.body.employee;
  const employee = await User.findOne({
    _id: employeeId,
    role: 'TAILOR',
    accountStatus: 'ACTIVE',
    isActive: true,
  });
  if (!employee)
    throw Object.assign(new Error('Active staff employee not found'), { statusCode: 404 });
  employee.defaultBaseSalary = Number(req.body.baseSalary);
  await employee.save();
  await audit(
    req.user._id,
    'SET_BASE_SALARY',
    'User',
    employee._id,
    { baseSalary: employee.defaultBaseSalary },
    req.ip,
  );
  res.json({ success: true, data: { user: employee.toSafeJSON() } });
});

export const updateSalary = asyncHandler(async (req, res) => {
  const row = await Salary.findById(req.params.id);
  if (!row) throw Object.assign(new Error('Salary record not found'), { statusCode: 404 });
  if (row.amountPaid > 0)
    throw Object.assign(new Error('Salary records cannot be edited after a payment is recorded'), {
      statusCode: 409,
    });
  for (const key of safeFields) if (req.body[key] !== undefined) row[key] = req.body[key];
  row.updatedBy = req.user._id;
  await row.save();
  await audit(
    req.user._id,
    'UPDATE',
    'Salary',
    row._id,
    { changedFields: Object.keys(req.body) },
    req.ip,
  );
  res.json({ success: true, data: await row.populate('employee', 'name phone role') });
});

export const recordSalaryPayment = asyncHandler(async (req, res) => {
  const row = await Salary.findById(req.params.id);
  if (!row) throw Object.assign(new Error('Salary record not found'), { statusCode: 404 });
  const remaining = Math.max(0, row.netSalary - row.amountPaid);
  const amount = req.body.amount === undefined ? remaining : Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > remaining)
    throw Object.assign(
      new Error('Payment must be positive and no greater than the remaining salary'),
      { statusCode: 400 },
    );
  row.payments.push({
    amount,
    method: req.body.method,
    reference: req.body.reference,
    paidAt: req.body.paidAt || new Date(),
    recordedBy: req.user._id,
  });
  row.updatedBy = req.user._id;
  await row.save();
  await audit(
    req.user._id,
    'PAYMENT',
    'Salary',
    row._id,
    { amount, paymentStatus: row.paymentStatus },
    req.ip,
  );
  const notification = await notifyUser(
    row.employee,
    'Salary payment recorded',
    `A salary payment of ${amount.toFixed(2)} was recorded.`,
    'PAYMENT',
    '/app/payroll',
  );
  pushNotification(req.app.get('io'), notification);
  res.status(201).json({ success: true, data: await row.populate('employee', 'name phone role') });
});
