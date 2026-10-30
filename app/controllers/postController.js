const Post = require("../models/Post");
const Category = require("../models/Category");
const Comment = require("../models/Comment");
const { isValidId, toObjectId, parseTags, isString } = require("../utils/helpers");

// Single post (or null) by id, with category, author, likes count and comments, all via aggregation
const getPost = async (id) => {
  const [post] = await Post.aggregate([
    { $match: { _id: toObjectId(id) } },
    ...postDetailStages(),
    {
      $lookup: {
        from: "comments",
        let: { postId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$post", "$$postId"] } } },
          { $sort: { createdAt: 1 } },
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
          { $project: { text: 1, author: 1, createdAt: 1 } }
        ],
        as: "comments"
      }
    }
  ]);
  return post || null;
};

// Shared stages: join author + category, expose likesCount instead of the full likes array
const postDetailStages = () => [
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
    $lookup: {
      from: "categories",
      localField: "category",
      foreignField: "_id",
      pipeline: [{ $project: { name: 1 } }],
      as: "category"
    }
  },
  { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  { $addFields: { likesCount: { $size: "$likes" } } },
  { $project: { likes: 0, __v: 0 } }
];

const categoryExists = async (id) => {
  const [category] = await Category.aggregate([{ $match: { _id: toObjectId(id) } }, { $limit: 1 }]);
  return Boolean(category);
};

// Loads { _id, author } for ownership checks
const findPostOwner = async (id) => {
  const [post] = await Post.aggregate([
    { $match: { _id: toObjectId(id) } },
    { $project: { author: 1 } },
    { $limit: 1 }
  ]);
  return post;
};

class PostController {

  // Create a post (author comes from the token)
  async create(req, res) {
    try {
      const { title, content, category, tags } = req.body;

      if (!isString(title) || !title.trim() || !isString(content) || !content.trim()) {
        return res.status(400).json({ message: "Title and content are required" });
      }
      if (title.trim().length > 200) {
        return res.status(400).json({ message: "Title can be at most 200 characters" });
      }
      if (!isValidId(category) || !(await categoryExists(category))) {
        return res.status(400).json({ message: "A valid category is required" });
      }

      const post = await Post.create({
        title: title.trim(),
        content: content.trim(),
        category,
        tags: parseTags(tags) || [],
        author: req.user.id
      });

      return res.status(201).json({ message: "Post created", post: await getPost(post._id) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Edit own post (title, content, category, tags)
  async update(req, res) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        return res.status(400).json({ message: "Invalid post id" });
      }

      const owner = await findPostOwner(id);
      if (!owner) {
        return res.status(404).json({ message: "Post not found" });
      }
      if (String(owner.author) !== req.user.id) {
        return res.status(403).json({ message: "You can only edit your own posts" });
      }

      const { title, content, category, tags } = req.body;
      const updates = {};

      if (title !== undefined) {
        if (!isString(title) || !title.trim()) return res.status(400).json({ message: "Title cannot be empty" });
        if (title.trim().length > 200) return res.status(400).json({ message: "Title can be at most 200 characters" });
        updates.title = title.trim();
      }
      if (content !== undefined) {
        if (!isString(content) || !content.trim()) return res.status(400).json({ message: "Content cannot be empty" });
        updates.content = content.trim();
      }
      if (category !== undefined) {
        if (!isValidId(category) || !(await categoryExists(category))) {
          return res.status(400).json({ message: "A valid category is required" });
        }
        updates.category = category;
      }
      if (tags !== undefined) {
        updates.tags = parseTags(tags);
      }

      await Post.updateOne({ _id: id }, updates);
      return res.json({ message: "Post updated", post: await getPost(id) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Delete own post (and its comments)
  async remove(req, res) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        return res.status(400).json({ message: "Invalid post id" });
      }

      const owner = await findPostOwner(id);
      if (!owner) {
        return res.status(404).json({ message: "Post not found" });
      }
      if (String(owner.author) !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own posts" });
      }

      await Post.deleteOne({ _id: id });
      await Comment.deleteMany({ post: id });

      return res.json({ message: "Post deleted" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Posts sorted by number of likes (most liked first), with pagination
  async listByLikes(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

      const [result] = await Post.aggregate([
        {
          $facet: {
            posts: [
              { $addFields: { likesCount: { $size: "$likes" } } },
              { $sort: { likesCount: -1, createdAt: -1, _id: 1 } },
              { $skip: (page - 1) * limit },
              { $limit: limit },
              ...postDetailStages()
            ],
            count: [{ $count: "total" }]
          }
        }
      ]);

      const posts = result.posts;
      const total = result.count.length ? result.count[0].total : 0;
      return res.json({ page, limit, total, totalPages: Math.ceil(total / limit), posts });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Single post with comments
  async getOne(req, res) {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: "Invalid post id" });
      }
      const post = await getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      return res.json(post);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Like / unlike a post
  async toggleLike(req, res) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) {
        return res.status(400).json({ message: "Invalid post id" });
      }

      const [post] = await Post.aggregate([
        { $match: { _id: toObjectId(id) } },
        { $project: { liked: { $in: [toObjectId(req.user.id), "$likes"] } } }
      ]);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      await Post.updateOne(
        { _id: id },
        post.liked ? { $pull: { likes: req.user.id } } : { $addToSet: { likes: req.user.id } }
      );

      const updated = await getPost(id);
      return res.json({ message: post.liked ? "Post unliked" : "Post liked", likesCount: updated.likesCount });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Add a comment to a post
  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { text } = req.body;

      if (!isValidId(id)) {
        return res.status(400).json({ message: "Invalid post id" });
      }
      if (!isString(text) || !text.trim() || text.length > 1000) {
        return res.status(400).json({ message: "Comment text is required (max 1000 characters)" });
      }
      if (!(await findPostOwner(id))) {
        return res.status(404).json({ message: "Post not found" });
      }

      await Comment.create({ post: id, author: req.user.id, text: text.trim() });
      return res.status(201).json({ message: "Comment added", post: await getPost(id) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
}

module.exports = new PostController();
