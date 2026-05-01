const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getS3Client } = require("./s3");

function requireBucket() {
  const bucket = (process.env.S3_BUCKET || "").trim();
  if (!bucket) {
    throw new Error("S3_BUCKET is not set");
  }
  return bucket;
}

/**
 * Path-style public URL (Hetzner / MinIO). Override with S3_PUBLIC_BASE_URL if needed.
 */
function publicUrlForKey(key) {
  const prefix = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (prefix) {
    return `${prefix}/${key}`;
  }
  const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "");
  const bucket = requireBucket();
  return `${endpoint}/${bucket}/${key}`;
}

async function putProfileImage({ key, body, contentType }) {
  const client = getS3Client();
  const bucket = requireBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return publicUrlForKey(key);
}

module.exports = { putProfileImage, requireBucket, publicUrlForKey };
