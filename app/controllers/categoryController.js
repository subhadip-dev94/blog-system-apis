const Category = require("../models/Category");
const { isString } = require("../utils/helpers");

class CategoryController {

  // Add a new category
  async create(req, res) {
    try {
      const { name, description } = req.body;

      if (!isString(name) || !name.trim() || !isString(description) || !description.trim()) {
        return res.status(400).json({ message: "Name and description are required" });
      }
      if (name.trim().length > 100 || description.trim().length > 500) {
        return res.status(400).json({ message: "Name max 100 and description max 500 characters" });
      }

      const [existing] = await Category.aggregate([{ $match: { name: name.trim() } }, { $limit: 1 }]).collation({
        locale: "en",
        strength: 2
      });
      if (existing) {
        return res.status(409).json({ message: "Category already exists" });
      }

      const category = await Category.create({
        name: name.trim(),
        description: description.trim(),
        createdBy: req.user.id
      });

      return res.status(201).json({ message: "Category created", category });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: "Category already exists" });
      }
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // All categories with total post count and the posts of each category
  async list(req, res) {
    try {
      const categories = await Category.aggregate([
        {
          $lookup: {
            from: "posts",
            let: { categoryId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$category", "$$categoryId"] } } },
              { $sort: { createdAt: -1 } },
              {
                $lookup: {
                  from: "users",
                  localField: "author",
                  foreignField: "_id",
                  pipeline: [{ $project: { name: 1, profilePicture: 1 } }],
                  as: "author"
                }
              },
              { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  title: 1,
                  excerpt: { $substrCP: ["$content", 0, 200] },
                  tags: 1,
                  author: 1,
                  likesCount: { $size: "$likes" },
                  createdAt: 1,
                  updatedAt: 1
                }
              }
            ],
            as: "posts"
          }
        },
        { $addFields: { totalPosts: { $size: "$posts" } } },
        { $project: { name: 1, description: 1, totalPosts: 1, posts: 1, createdAt: 1 } },
        { $sort: { name: 1 } }
      ]);

      return res.json(categories);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
}

module.exports = new CategoryController();
