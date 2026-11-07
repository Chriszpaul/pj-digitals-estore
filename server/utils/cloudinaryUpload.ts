import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder = "pj-digitals-estore/products",
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    let settled = false;

    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (settled) return;
        settled = true;
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no upload result"));
        resolve(result);
      },
    );

    stream.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    stream.end(file.buffer);
  });
};

// Supports URL strings and older Cloudinary result objects.
export const getCloudinaryPublicId = (image: any): string | null => {
  if (!image) return null;
  if (typeof image === "object" && image.public_id) return image.public_id;

  const imageUrl = typeof image === "string" ? image : image.secure_url || image.url;
  if (typeof imageUrl !== "string") return null;

  try {
    const pathname = new URL(imageUrl).pathname;
    const marker = "/upload/";
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;

    let segments = pathname
      .slice(idx + marker.length)
      .split("?")[0]
      .split("/")
      .filter(Boolean);

    const versionIndex = segments.findIndex((s) => /^v\d+$/.test(s));
    if (versionIndex !== -1) segments = segments.slice(versionIndex + 1);
    else if (segments[0]?.includes(",")) segments = segments.slice(1);
    if (segments.length === 0) return null;

    const last = segments.length - 1;
    segments[last] = segments[last].replace(/\.[^/.]+$/, "");
    return decodeURIComponent(segments.join("/"));
  } catch {
    return null;
  }
};

export const destroyImages = async (images: (string | undefined | null)[]) => {
  const results = await Promise.allSettled(
    images.filter(Boolean).map(async (image) => {
      const publicId = getCloudinaryPublicId(image);
      if (!publicId) return null;
      return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    }),
  );
  results.forEach((r) => {
    if (r.status === "rejected") console.error("CLOUDINARY DELETE ERROR:", r.reason);
  });
};
