const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "uploads"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ALLOWED[file.mimetype]}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const err = new Error("Only JPG, PNG or WEBP images are allowed");
    err.isUploadError = true;
    cb(err);
  }
});

const SIGNATURES = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"
};

// Runs after multer: the client-supplied mimetype is not trusted, so check the file's magic bytes
const verifyImage = (req, res, next) => {
  if (!req.file) return next();
  const fd = fs.openSync(req.file.path, "r");
  const head = Buffer.alloc(12);
  fs.readSync(fd, head, 0, 12, 0);
  fs.closeSync(fd);
  if (SIGNATURES[req.file.mimetype](head)) return next();
  fs.unlink(req.file.path, () => {});
  return res.status(400).json({ message: "File content is not a valid image" });
};

module.exports = upload;
module.exports.verifyImage = verifyImage;
