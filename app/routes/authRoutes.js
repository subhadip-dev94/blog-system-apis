const router = require("express").Router();
const auth = require("../controllers/authController");

router.post("/signup", auth.signup);
router.get("/verify-email/:token", auth.verifyEmail);
router.post("/resend-verification", auth.resendVerification);
router.post("/login", auth.login);

module.exports = router;
