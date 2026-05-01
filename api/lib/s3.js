const { S3Client } = require("@aws-sdk/client-s3");

/**
 * Hetzner Object Storage / MinIO / AWS — configured exclusively via env.
 * Call only after dotenv has loaded (or when process.env is set).
 */
function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || "eu-central-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle =
    String(process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() ===
    "true";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage not configured: set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
    );
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });
}

module.exports = { getS3Client };
