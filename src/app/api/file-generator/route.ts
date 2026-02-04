import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = "em-admin-assets";
const GENERATED_PREFIX = "generated/";

// GET - List generated files
export async function GET() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: GENERATED_PREFIX,
    });

    const response = await s3Client.send(command);
    const files = (response.Contents || [])
      .filter((obj) => obj.Key !== GENERATED_PREFIX) // Exclude folder marker
      .map((obj) => ({
        key: obj.Key,
        url: `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${obj.Key}`,
        size: obj.Size,
        lastModified: obj.LastModified,
      }));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error listing generated files:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list files" },
      { status: 500 }
    );
  }
}

// POST - Upload a generated file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const filename = formData.get("filename") as string | null;

    if (!file && !filename) {
      return NextResponse.json(
        { error: "Either file or filename is required" },
        { status: 400 }
      );
    }

    const finalFilename = filename || file?.name || `generated-${Date.now()}.png`;
    const key = `${GENERATED_PREFIX}${finalFilename}`;

    let body: Buffer;
    let contentType: string;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      body = Buffer.from(arrayBuffer);
      contentType = file.type || "application/octet-stream";
    } else {
      // Placeholder for generated content
      body = Buffer.from("");
      contentType = "application/octet-stream";
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      key,
      url,
      filename: finalFilename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    );
  }
}
