require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getS3Client } = require("../lib/s3");

async function main() {
  const zipPath = path.resolve(
    __dirname,
    "../../app/release/Serenidad-1.0.0-universal-mac.zip",
  );
  const dmgPath = path.resolve(
    __dirname,
    "../../app/release/Serenidad-1.0.0-universal.dmg",
  );

  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT.replace(/\/$/, "");
  const client = getS3Client();

  const uploads = [
    { file: zipPath, key: "desktop/Serenidad-mac.zip", type: "application/zip" },
    { file: dmgPath, key: "desktop/Serenidad-mac.dmg", type: "application/x-apple-diskimage" },
  ];

  for (const { file, key, type } of uploads) {
    const stat = fs.statSync(file);
    process.stdout.write(`Uploading ${path.basename(file)} (${(stat.size / 1024 / 1024).toFixed(1)} MB)... `);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(file),
        ContentLength: stat.size,
        ContentType: type,
        ContentDisposition: `attachment; filename="${path.basename(file)}"`,
        ACL: "public-read",
      }),
    );
    console.log("done");
    console.log(`  ${endpoint}/${bucket}/${key}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
