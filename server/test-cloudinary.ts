
import "dotenv/config";
import cloudinary from "./config/cloudinary.js";

async function testUpload() {
  try {
    const result = await cloudinary.uploader.upload(
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      {
        folder: "pj-digitals-estore/test",
        resource_type: "image",
      }
    );

    console.log("UPLOAD SUCCESS:", result.secure_url);
  } catch (error: any) {
    console.error("UPLOAD TEST FAILED:");
    console.dir(error, { depth: 10 });
  }
}

testUpload();
