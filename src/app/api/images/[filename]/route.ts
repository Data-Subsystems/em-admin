import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET_NAME = "em-admin-assets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `images/${filename}`,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const bytes = await response.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.ContentType || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch image" },
      { status: 500 }
    );
  }
}
