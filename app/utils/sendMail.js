const nodemailer = require("nodemailer");

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const sendVerificationEmail = async (user, link) => {
  // Development fallback: no SMTP configured, print the link instead
  if (!process.env.EMAIL_HOST) {
    console.log(`[mail disabled] Verification link for ${user.email}: ${link}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: "Verify your email address",
    html: `
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>Please verify your email address by clicking the link below (valid for 24 hours):</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not sign up, please ignore this email.</p>`
  });
};

module.exports = { sendVerificationEmail };
