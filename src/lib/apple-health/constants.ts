export const APPLE_HEALTH_BATCH_SIZE = 500;

export const APPLE_HEALTH_MAX_RECORDS = 5_000_000;

export const APPLE_HEALTH_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export const APPLE_HEALTH_DATE_FORMATS = [
  "yyyy-MM-dd HH:mm:ss xx",
  "yyyy-MM-dd HH:mm:ss ZZZ",
  "yyyy-MM-dd HH:mm:ss",
] as const;
