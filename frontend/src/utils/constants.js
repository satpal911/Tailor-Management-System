export const ROLES = { ADMIN: 'ADMIN', TAILOR: 'TAILOR', CUSTOMER: 'CUSTOMER' };
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'ASSIGNED',
  'CUTTING',
  'STITCHING',
  'QUALITY_CHECK',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
];
export const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
export const date = (d) =>
  d
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(d),
      )
    : '—';
export const errorMessage = (e) => {
  const errors = e.response?.data?.errors;
  if (Array.isArray(errors) && errors.length)
    return errors.map((error) => error.message).filter(Boolean).join(' ');
  return e.response?.data?.message || e.message || 'Request failed';
};
