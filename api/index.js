import connectDatabase from "../config/db.js";
import ensureSuperAdmin from "../config/superAdmin.js";
import { app } from "../index.js";

let databaseReady;

const prepareDatabase = async () => {
  if (!databaseReady) {
    databaseReady = connectDatabase().then(() => ensureSuperAdmin());
  }
  await databaseReady;
};

export default async (req, res) => {
  await prepareDatabase();
  return app(req, res);
};