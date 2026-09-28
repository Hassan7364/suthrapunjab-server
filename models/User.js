import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["user", "superAdmin"], default: "user", required: true },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
