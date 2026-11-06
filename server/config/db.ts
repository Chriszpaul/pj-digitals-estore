import "dotenv/config";
import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected successfully");
  });
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
};

export default connectDB;
