import nodemailer from "nodemailer";

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

function getTransporter() {
  if (!process.env.SMTP_HOST) {
    // Development: log emails to console
    return {
      sendMail: async (options: SendMailOptions) => {
        console.log("\n=== DEV EMAIL ===");
        console.log("To:", options.to);
        console.log("Subject:", options.subject);
        console.log("Body:", options.html);
        console.log("=================\n");
        return { messageId: "dev-" + Date.now() };
      },
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  const transporter = getTransporter();
  await transporter.sendMail({
    to: email,
    subject: "Verify your ClanTrader account",
    html: `
      <h2>Welcome to ClanTrader</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const transporter = getTransporter();
  await transporter.sendMail({
    to: email,
    subject: "Reset your ClanTrader password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
  });
}
