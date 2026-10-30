const mongoose = require("mongoose");

const isValidId = (id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const isEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Accepts ["a","b"] or "a, b" and returns a clean, de-duplicated, lowercase list (max 10 tags, 30 chars each)
const parseTags = (tags) => {
  if (tags === undefined || tags === null) return undefined;
  const list = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",") : [];
  return [...new Set(list.filter((t) => typeof t === "string").map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 30))].slice(0, 10);
};

const isString = (value) => typeof value === "string";

module.exports = { isValidId, toObjectId, isEmail, parseTags, isString };
