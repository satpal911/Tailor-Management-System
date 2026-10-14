export const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
