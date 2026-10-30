const router = require("express").Router();
const user = require("../controllers/userController");
const auth = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const { verifyImage } = upload;

router.get("/me", auth, user.getMe);
router.put("/me", auth, upload.single("profilePicture"), verifyImage, user.updateMe);

module.exports = router;
