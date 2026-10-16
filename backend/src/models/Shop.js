import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
    domains: { type: [String], required: true, validate: (domains) => domains.length > 0 },
    provisionedFromApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopApplication',
      default: undefined,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
schema.index({ domains: 1 }, { unique: true });
schema.index(
  { provisionedFromApplication: 1 },
  { unique: true, sparse: true, name: 'provisioned_from_application_unique' },
);
schema.pre('validate', function normalizeDomains() {
  this.domains = [
    ...new Set((this.domains || []).map((domain) => String(domain).toLowerCase().trim())),
  ];
});

export default mongoose.model('Shop', schema);
