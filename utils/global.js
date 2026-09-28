const allowedReportFields = ["date", "amo", "uc", "tcp", "supervisor", "vehicleNo", "remarks"];

export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export const sendSuccess = (res, data, status = 200, message = "OK") =>
  res.status(status).json({ success: true, message, data });

export const reportFields = (body = {}) => {
  const input = body && typeof body === "object" ? body : {};
  return Object.fromEntries(
    allowedReportFields
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, typeof input[field] === "string" ? input[field].trim() : input[field]]),
  );
};

export const isValidReportDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
