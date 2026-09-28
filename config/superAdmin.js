import bcrypt from "bcryptjs";
import User from "../models/User.js";

const ensureSuperAdmin = async () => {
  const fullName = process.env.SUPERADMIN_NAME?.trim();
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!fullName || fullName.length < 3 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set a valid SUPERADMIN_NAME and SUPERADMIN_EMAIL in server/.env.");
  }
  if (!password || password.length < 12) {
    throw new Error("Set a SUPERADMIN_PASSWORD with at least 12 characters in server/.env.");
  }

  const user = await User.findOne({ email }).select("+password role");
  if (!user) {
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ fullName, email, password: hashedPassword, role: "superAdmin" });
    console.log("Created the configured superAdmin account.");
    return;
  }

  if (user.role === "superAdmin") return;

  if (!(await bcrypt.compare(password, user.password))) {
    throw new Error("The configured superAdmin email belongs to another account; verify the account password.");
  }

  user.role = "superAdmin";
  user.fullName = fullName;
  await user.save();
  console.log("Promoted the configured account to superAdmin.");
};

export default ensureSuperAdmin;
