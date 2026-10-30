const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    bio: { type: String, default: "", trim: true, maxlength: 500 },
    profilePicture: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    // sha256 hash of the emailed token; the raw token is never stored
    verificationToken: { type: String },
    verificationExpires: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ verificationToken: 1 }, { sparse: true });

module.exports = mongoose.model("User", userSchema);
