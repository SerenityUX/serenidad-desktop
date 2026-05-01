const { Resend } = require("resend");

function getResend() {
  const apiKey = process.env.RESEND_API_TOKEN;
  if (!apiKey) {
    throw new Error("RESEND_API_TOKEN is not set");
  }
  const from =
    process.env.RESEND_FROM_EMAIL || "Serenidad <onboarding@resend.dev>";
  return { resend: new Resend(apiKey), from };
}

async function sendOtpEmail(to, code) {
  const { resend, from } = getResend();
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

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendProjectShareEmail({ to, projectName, sharerName, sharerEmail }) {
  const { resend, from } = getResend();
  const projectSafe = escapeHtml(projectName || "a project");
  const who = escapeHtml(sharerName || sharerEmail || "Someone");
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `${sharerName || sharerEmail || "Someone"} shared a project with you on Kōdan`,
    html: `<p>${who} shared the project <strong>${projectSafe}</strong> with you on Kōdan Anime Studio.</p><p>Open the app — it will appear in your projects list and you can make changes alongside them.</p>`,
  });
  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
}

async function sendProjectInviteSignupEmail({ to, sharerName, sharerEmail }) {
  const { resend, from } = getResend();
  const who = escapeHtml(sharerName || sharerEmail || "Someone");
  const whoPlain = sharerName || sharerEmail || "Someone";
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `${whoPlain} sent you an invite to Serenidad`,
    html: `<p>${who} sent you an invite to Serenidad. Go create an account and you can begin telling the story with ${who}.</p><p><a href="https://serenidad.app">https://serenidad.app</a></p>`,
  });
  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
}

module.exports = {
  sendOtpEmail,
  sendProjectShareEmail,
  sendProjectInviteSignupEmail,
};
