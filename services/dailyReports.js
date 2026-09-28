import Report from "../models/Report.js";
import User from "../models/User.js";
import { deleteImage } from "../config/cloudinary.js";
import { businessDate, shiftBusinessDate } from "../utils/businessDate.js";

const createTodayRoster = async (today) => {
  const yesterday = shiftBusinessDate(today, -1);
  const owners = await User.find({ role: "superAdmin" }).select("_id").lean();

  for (const owner of owners) {
    const yesterdayReports = await Report.find({ owner: owner._id, date: yesterday })
      .select("amo uc tcp supervisor vehicleNo remarks")
      .lean();
    const rosterByVehicle = new Map();

    for (const report of yesterdayReports) {
      if (!rosterByVehicle.has(report.vehicleNo)) rosterByVehicle.set(report.vehicleNo, report);
    }

    const operations = [...rosterByVehicle.values()].map((report) => ({
      updateOne: {
        filter: { owner: owner._id, date: today, vehicleNo: report.vehicleNo },
        update: {
          $setOnInsert: {
            owner: owner._id,
            date: today,
            amo: report.amo,
            uc: report.uc,
            tcp: report.tcp || "",
            supervisor: report.supervisor,
            vehicleNo: report.vehicleNo,
            remarks: report.remarks || "",
            trip1Image: null,
            trip2Image: null,
            trip3Image: null,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length) await Report.bulkWrite(operations, { ordered: false });
  }
};

const deleteExpiredImages = async (today) => {
  const cursor = Report.find({
    date: { $lt: today },
    $or: ["trip1Image", "trip2Image", "trip3Image"].map((field) => ({ [`${field}.publicId`]: { $exists: true } })),
  })
    .select("trip1Image trip2Image trip3Image")
    .lean()
    .cursor();
  let deletedCount = 0;
  let failedCount = 0;

  for await (const report of cursor) {
    const imageFields = ["trip1Image", "trip2Image", "trip3Image"];
    await Promise.all(
      imageFields.map(async (field) => {
        const image = report[field];
        if (!image?.publicId) return;

        try {
          await deleteImage(image.publicId);
          await Report.updateOne(
            { _id: report._id, [`${field}.publicId`]: image.publicId },
            { $set: { [field]: null } },
          );
          deletedCount += 1;
        } catch (error) {
          failedCount += 1;
          console.error(`Image retention cleanup failed for report ${report._id}, field ${field}:`, error.message);
        }
      }),
    );
  }

  if (deletedCount || failedCount) {
    console.log(`Expired images: ${deletedCount} deleted, ${failedCount} queued for retry.`);
  }
};

export const runDailyReportMaintenance = async () => {
  const today = businessDate();
  await createTodayRoster(today);
  await deleteExpiredImages(today);
  return today;
};
