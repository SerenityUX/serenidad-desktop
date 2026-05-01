const { Resend } = require("resend");

async function sendOtpEmail(to, code) {
  const apiKey = process.env.RESEND_API_TOKEN;
  if (!apiKey) {
    throw new Error("RESEND_API_TOKEN is not set");
  }
  const from =
    process.env.RESEND_FROM_EMAIL || "Serenidad <onboarding@resend.dev>";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Your Serenidad verification code",
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
}

module.exports = { sendOtpEmail };
