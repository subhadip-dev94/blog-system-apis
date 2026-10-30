const fs = require("fs");
const path = require("path");
const User = require("../models/User");
const { toObjectId, isString } = require("../utils/helpers");

// Profile of a user via aggregation (password and token fields never leave the database)
const getProfile = async (id) => {
  const [profile] = await User.aggregate([
    { $match: { _id: toObjectId(id) } },
    { $project: { name: 1, email: 1, bio: 1, profilePicture: 1, isVerified: 1, createdAt: 1, updatedAt: 1 } }
  ]);
  return profile;
};

const removeUpload = (publicPath) => {
  if (!publicPath) return;
  const file = path.join(__dirname, "..", "..", "uploads", path.basename(publicPath));
  fs.unlink(file, () => {});
};

class UserController {

  // Logged-in user's profile
  async getMe(req, res) {
    try {
      const profile = await getProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.json(profile);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }

  // Edit profile (name, bio, optional new profilePicture file)
  async updateMe(req, res) {
    try {
      const { name, bio } = req.body;
      const updates = {};

      if (name !== undefined) {
        if (!isString(name) || !name.trim()) {
          removeUpload(req.file && req.file.filename);
          return res.status(400).json({ message: "Name cannot be empty" });
        }
        updates.name = name.trim();
      }
      if (bio !== undefined) {
        if (!isString(bio) || bio.length > 500) {
          removeUpload(req.file && req.file.filename);
          return res.status(400).json({ message: "Bio must be text up to 500 characters" });
        }
        updates.bio = bio.trim();
      }
      if (req.file) {
        updates.profilePicture = `/uploads/${req.file.filename}`;
      }

      const current = await getProfile(req.user.id);
      if (!current) {
        removeUpload(req.file && req.file.filename);
        return res.status(404).json({ message: "User not found" });
      }

      try {
        await User.updateOne({ _id: req.user.id }, updates);
      } catch (dbError) {
        removeUpload(req.file && req.file.filename);
        throw dbError;
      }
      if (req.file) removeUpload(current.profilePicture);

      return res.json({ message: "Profile updated", profile: await getProfile(req.user.id) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
}

module.exports = new UserController();
