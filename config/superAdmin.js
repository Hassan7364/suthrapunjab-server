import bcrypt from "bcryptjs";
import User from "../models/User.js";

const configuredAdmins = () =>
  [
    {
      fullName: process.env.SUPERADMIN_NAME?.trim(),
      email: process.env.SUPERADMIN_EMAIL?.trim().toLowerCase(),
      password: process.env.SUPERADMIN_PASSWORD,
    },
    {
      fullName: process.env.SUPERADMIN2_NAME?.trim(),
      email: process.env.SUPERADMIN2_EMAIL?.trim().toLowerCase(),
      password: process.env.SUPERADMIN2_PASSWORD,
    },
  ].filter(({ fullName, email, password }) => fullName || email || password);

const ensureSuperAdmin = async () => {
  const admins = configuredAdmins();
  if (admins.length === 0) throw new Error("Configure at least one superAdmin account in server/.env.");

  for (const { fullName, email, password } of admins) {
    if (!fullName || fullName.length < 3 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Set a valid superAdmin name and email in server/.env.");
    }
    if (!password || password.length < 12) {
      throw new Error("Set each superAdmin password with at least 12 characters in server/.env.");
    }

    const user = await User.findOne({ email }).select("+password role");
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await User.create({ fullName, email, password: hashedPassword, role: "superAdmin" });
      console.log(`Created configured superAdmin account for ${email}.`);
      continue;
    }

    if (user.role === "superAdmin") continue;
    if (!(await bcrypt.compare(password, user.password))) {
      throw new Error(`The configured superAdmin email ${email} belongs to another account.`);
    }

    user.role = "superAdmin";
    user.fullName = fullName;
    await user.save();
    console.log(`Promoted ${email} to superAdmin.`);
  }
};

export default ensureSuperAdmin;
