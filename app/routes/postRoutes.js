const router = require("express").Router();
const post = require("../controllers/postController");
const auth = require("../middlewares/authMiddleware");

router.get("/", post.listByLikes);
router.get("/:id", post.getOne);
router.post("/", auth, post.create);
router.put("/:id", auth, post.update);
router.delete("/:id", auth, post.remove);
router.post("/:id/like", auth, post.toggleLike);
router.post("/:id/comments", auth, post.addComment);

module.exports = router;
