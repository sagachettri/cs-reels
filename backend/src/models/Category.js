import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 40 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Category = mongoose.model('Category', categorySchema);
