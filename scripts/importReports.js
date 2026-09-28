import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import connectDatabase from "../config/db.js";
import ensureSuperAdmin from "../config/superAdmin.js";
import Report from "../models/Report.js";
import User from "../models/User.js";

const [inputPath, reportDate] = process.argv.slice(2);

const run = async () => {
  if (!inputPath || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate || "")) {
    throw new Error("Usage: npm run import:reports -- <json-file> <YYYY-MM-DD>");
  }

  const input = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const rows = Array.isArray(input)
    ? input
    : input?.groups?.flatMap(({ amo, tcp, teams = [] }) =>
        teams.flatMap(({ uc, supervisor, vehicles = [], amo: teamAmo, tcp: teamTcp }) =>
          vehicles.map((vehicle) => {
            const [rickshaw, remarks = ""] = Array.isArray(vehicle) ? vehicle : [vehicle, ""];
            return { amo: teamAmo || amo, tcp: teamTcp || tcp, uc, supervisor, rickshaw, remarks };
          }),
        ),
      );
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Input must be a non-empty JSON array.");

  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const owner = await User.findOne({ email, role: "superAdmin" }).select("_id");
  if (!owner) throw new Error("Configured superAdmin account was not found in the database.");

  const records = rows.map((row, index) => {
    const vehicleNo = typeof row.rickshaw === "string" ? row.rickshaw.trim() : "";
    const fields = {
      owner: owner._id,
      date: reportDate,
      amo: typeof row.amo === "string" ? row.amo.trim() : "",
      uc: typeof row.uc === "string" ? row.uc.trim() : "",
      tcp: typeof row.tcp === "string" ? row.tcp.trim() : "",
      supervisor: typeof row.supervisor === "string" ? row.supervisor.trim() : "",
      vehicleNo,
      remarks: typeof row.remarks === "string" ? row.remarks.trim() : "",
    };

    if (!fields.amo || !fields.uc || !fields.supervisor || !fields.vehicleNo) {
      throw new Error(`Row ${index + 1} is missing amo, uc, supervisor, or rickshaw.`);
    }

    return { index, fields };
  });

  const seenVehicles = new Set();
  for (const { index, fields } of records) {
    if (seenVehicles.has(fields.vehicleNo)) {
      throw new Error(`Duplicate rickshaw value on rows ${index + 1}: ${fields.vehicleNo}`);
    }
    seenVehicles.add(fields.vehicleNo);
    await new Report(fields).validate();
  }

  const existingReports = await Report.find({
    owner: owner._id,
    date: reportDate,
    vehicleNo: { $in: records.map(({ fields }) => fields.vehicleNo) },
  })
    .select("amo uc tcp supervisor vehicleNo remarks")
    .lean();
  const existingByVehicle = new Map(existingReports.map((report) => [report.vehicleNo, report]));
  const recordsToWrite = records.filter(({ fields }) => {
    const existing = existingByVehicle.get(fields.vehicleNo);
    if (!existing) return true;

    const hasSameData = ["amo", "uc", "tcp", "supervisor", "remarks"].every(
      (key) => (existing[key] || "") === fields[key],
    );
    if (!hasSameData) {
      throw new Error("Existing reports conflict with this import; no records were written.");
    }
    return false;
  });

  if (recordsToWrite.length === 0) {
    console.log(`All ${records.length} records for ${reportDate} are already present; nothing changed.`);
    return;
  }

  const result = await Report.bulkWrite(
    recordsToWrite.map(({ fields }) => ({
      updateOne: {
        filter: { owner: owner._id, date: reportDate, vehicleNo: fields.vehicleNo },
        update: { $set: fields },
        upsert: true,
      },
    })),
    { ordered: true },
  );

  console.log(
    `Imported ${recordsToWrite.length} records for ${reportDate}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated; ${records.length - recordsToWrite.length} identical records skipped.`,
  );
};

try {
  await connectDatabase();
  await ensureSuperAdmin();
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await Report.db?.close().catch(() => {});
}
