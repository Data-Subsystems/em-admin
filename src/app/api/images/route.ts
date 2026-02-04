import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET_NAME = "em-admin-assets";

export async function GET(request: Request) {
  try {
    // Get base URL for proxy
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: "images/",
    });

    const response = await s3Client.send(command);

    const images = (response.Contents || [])
      .filter((obj) => obj.Key && obj.Key.endsWith(".png"))
      .map((obj) => {
        const filename = obj.Key!.replace("images/", "");
        const modelName = filename.replace(".png", "");
        return {
          key: obj.Key,
          filename,
          modelName,
          url: `${baseUrl}/api/images/${encodeURIComponent(filename)}`,
          size: obj.Size,
          lastModified: obj.LastModified,
        };
      })
      .sort((a, b) => a.modelName.localeCompare(b.modelName));

    return NextResponse.json({
      success: true,
      count: images.length,
      images,
    });
  } catch (error) {
    console.error("Error listing images:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list images" },
      { status: 500 }
    );
  }
}
