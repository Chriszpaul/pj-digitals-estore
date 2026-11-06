import multer from "multer";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG, PNG, WEBP or AVIF images are allowed"));
  },
});

export default upload;
