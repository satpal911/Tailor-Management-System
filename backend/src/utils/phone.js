const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export function normalizePhone(value, countryCode = process.env.DEFAULT_PHONE_COUNTRY_CODE || '') {
  const raw = String(value || '').trim();
  let digits = digitsOnly(raw);
  if (!digits || digits.length < 7 || digits.length > 15) {
    throw Object.assign(new Error('Enter a valid phone number'), { statusCode: 400 });
  }

  if (!raw.startsWith('+')) {
    const country = digitsOnly(countryCode);
    if (country && !digits.startsWith(country)) digits = `${country}${digits.replace(/^0+/, '')}`;
  }
  if (digits.length < 7 || digits.length > 15) {
    throw Object.assign(new Error('Enter a valid phone number'), { statusCode: 400 });
  }
  return `+${digits}`;
}
