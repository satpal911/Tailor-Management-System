import mongoose from 'mongoose';

const platformAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('PlatformAdmin', platformAdminSchema);
