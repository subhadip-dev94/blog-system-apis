const router = require("express").Router();
const category = require("../controllers/categoryController");
const auth = require("../middlewares/authMiddleware");

router.get("/", category.list);
router.post("/", auth, category.create);

module.exports = router;
