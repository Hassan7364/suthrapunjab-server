import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import { asyncHandler, sendSuccess } from "../utils/global.js";

const router = Router();

const publicUser = (user) => ({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
const createToken = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

(router.post("/register", (_req, res) => {
  return res.status(403).json({
    success: false,
    message: "Public registration is disabled. Configure the superAdmin account in server/.env.",
  });
}),
  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const user = await User.findOne({ email, role: "superAdmin" }).select("+password");
      const passwordMatches = user && (await bcrypt.compare(password, user.password));

      if (!passwordMatches) {
        const error = new Error("Email or password is incorrect.");
        error.status = 401;
        throw error;
      }

      return sendSuccess(res, { user: publicUser(user), token: createToken(user) }, 200, "Signed in.");
    }),
  ));

router.get(
  "/me",
  auth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    return sendSuccess(res, publicUser(user));
  }),
);

export default router;
