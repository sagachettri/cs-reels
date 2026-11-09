import { Category } from '../models/Category.js';
import { Reel } from '../models/Reel.js';
import { sendSuccess } from '../utils/helpers.js';

export async function listCategories(req, res) {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }).lean(),
    Reel.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));

  return sendSuccess(res, {
    categories: categories.map((c) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      description: c.description,
      reelCount: countById.get(String(c._id)) || 0,
    })),
  });
}
