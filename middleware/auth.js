import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication is required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id role");
    if (!user || user.role !== "superAdmin") {
      return res.status(401).json({ success: false, message: "Authentication is invalid or unauthorized." });
    }

    req.user = { id: user.id, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Authentication is invalid or expired." });
  }
};

export default auth;
