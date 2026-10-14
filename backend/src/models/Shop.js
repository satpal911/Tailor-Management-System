import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    domains: { type: [String], required: true, validate: (domains) => domains.length > 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
schema.index({ domains: 1 }, { unique: true });
schema.pre('validate', function normalizeDomains() {
  this.domains = [
    ...new Set((this.domains || []).map((domain) => String(domain).toLowerCase().trim())),
  ];
});

export default mongoose.model('Shop', schema);
