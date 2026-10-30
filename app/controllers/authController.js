const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail } = require("../utils/sendMail");
const { isEmail, isString } = require("../utils/helpers");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Fetch a single user by email using an aggregation pipeline
const findUserByEmail = async (email) => {
  const [user] = await User.aggregate([{ $match: { email } }, { $limit: 1 }]);
  return user;
};

// Create a fresh verification token, store its hash and email the raw token
const issueVerification = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  await User.updateOne(
    { _id: user._id },
    { verificationToken: hashToken(token), verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  );
  const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  await sendVerificationEmail(user, `${base}/api/auth/verify-email/${token}`);
};

class AuthController {

  // User signup (sends verification email)
  async signup(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!isString(name) || !name.trim() || !isEmail(email) || !isString(password)) {
        return res.status(400).json({ message: "Valid name, email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (await findUserByEmail(normalizedEmail)) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10)
      });

      try {
        await issueVerification(user);
      } catch (mailError) {
        console.error("Verification email failed:", mailError.message);
        return res.status(201).json({
          message: "Account created, but the verification email could not be sent. Use /api/auth/resend-verification."
        });
      }

      return res.status(201).json({ message: "Signup successful. Please check your email to verify your account." });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: "Email already registered" });
      }
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Verify email using the emailed token
  async verifyEmail(req, res) {
    try {
      const [user] = await User.aggregate([
        { $match: { verificationToken: hashToken(req.params.token), verificationExpires: { $gt: new Date() } } },
        { $limit: 1 }
      ]);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification link" });
      }

      await User.updateOne(
        { _id: user._id },
        { isVerified: true, $unset: { verificationToken: "", verificationExpires: "" } }
      );

      return res.json({ message: "Email verified successfully. You can now log in." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Resend the verification email
  async resendVerification(req, res) {
    try {
      const { email } = req.body;
      if (!isEmail(email)) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      const user = await findUserByEmail(email.trim().toLowerCase());
      if (user && !user.isVerified) {
        await issueVerification(user);
      }

      // Same answer either way so the endpoint doesn't reveal which emails exist
      return res.json({ message: "If the account exists and is unverified, a new link has been sent." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Login with email and password
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!isEmail(email) || !isString(password)) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await findUserByEmail(email.trim().toLowerCase());
      // Always run one bcrypt compare so response time doesn't reveal whether the email exists
      const passwordOk = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
      if (!user || !passwordOk) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isVerified) {
        return res.status(403).json({ message: "Please verify your email before logging in" });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      });

      return res.json({ message: "Login successful", token });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
}

module.exports = new AuthController();
