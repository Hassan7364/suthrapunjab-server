import { Router } from "express";
import multer from "multer";
import auth from "../middleware/auth.js";
import Report from "../models/Report.js";
import { deleteImage, uploadImage } from "../config/cloudinary.js";
import { asyncHandler, isValidReportDate, reportFields, sendSuccess } from "../utils/global.js";

const router = Router();
const imageFields = new Set(["trip1Image", "trip2Image", "trip3Image"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files can be uploaded.");
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

router.use(auth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.date) {
      if (!isValidReportDate(req.query.date)) {
        const error = new Error("Date must use YYYY-MM-DD format.");
        error.status = 400;
        throw error;
      }
      filter.date = req.query.date;
    }

    const reports = await Report.find(filter).sort({ date: -1, createdAt: -1 });
    return sendSuccess(res, reports);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const fields = reportFields(req.body);
    fields.date ||= new Date().toISOString().slice(0, 10);
    if (!isValidReportDate(fields.date)) {
      const error = new Error("Date must use YYYY-MM-DD format.");
      error.status = 400;
      throw error;
    }

    const report = await Report.create({ ...fields, owner: req.user.id });
    return sendSuccess(res, report, 201, "Report created.");
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const fields = reportFields(req.body);
    if (fields.date !== undefined && !isValidReportDate(fields.date)) {
      const error = new Error("Date must use YYYY-MM-DD format.");
      error.status = 400;
      throw error;
    }

    const report = await Report.findOneAndUpdate(
      { _id: req.params.id },
      { $set: fields },
      { new: true, runValidators: true },
    );
    if (!report) {
      const error = new Error("Report not found.");
      error.status = 404;
      throw error;
    }
    return sendSuccess(res, report, 200, "Report updated.");
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const report = await Report.findOneAndDelete({ _id: req.params.id });
    if (!report) {
      const error = new Error("Report not found.");
      error.status = 404;
      throw error;
    }

    await Promise.all(
      [report.trip1Image, report.trip2Image, report.trip3Image]
        .filter(Boolean)
        .map(({ publicId }) => deleteImage(publicId).catch(() => undefined)),
    );
    return sendSuccess(res, { id: report.id }, 200, "Report deleted.");
  }),
);

router.post(
  "/:id/images/:tripField",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!imageFields.has(req.params.tripField)) {
      const error = new Error("Unknown trip image field.");
      error.status = 400;
      throw error;
    }

    const report = await Report.findOne({ _id: req.params.id });
    if (!report) {
      const error = new Error("Report not found.");
      error.status = 404;
      throw error;
    }
    if (!req.file) {
      const error = new Error("An image file is required.");
      error.status = 400;
      throw error;
    }

    const field = req.params.tripField;
    const previousImage = report[field];
    const uploadedImage = await uploadImage(req.file.buffer);
    report[field] = uploadedImage;
    try {
      await report.save();
    } catch (error) {
      await deleteImage(uploadedImage.publicId).catch(() => undefined);
      throw error;
    }
    if (previousImage?.publicId) await deleteImage(previousImage.publicId).catch(() => undefined);

    return sendSuccess(res, report, 200, "Image uploaded.");
  }),
);

router.delete(
  "/:id/images/:tripField",
  asyncHandler(async (req, res) => {
    if (!imageFields.has(req.params.tripField)) {
      const error = new Error("Unknown trip image field.");
      error.status = 400;
      throw error;
    }

    const report = await Report.findOne({ _id: req.params.id });
    if (!report) {
      const error = new Error("Report not found.");
      error.status = 404;
      throw error;
    }

    const field = req.params.tripField;
    const previousImage = report[field];
    report[field] = null;
    await report.save();
    if (previousImage?.publicId) await deleteImage(previousImage.publicId).catch(() => undefined);

    return sendSuccess(res, report, 200, "Image removed.");
  }),
);

export default router;
