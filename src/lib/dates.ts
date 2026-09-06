/**
 * App-wide timezone handling.
 *
 * Dates are stored as instants; user-calendar dates are anchored at the
 * client's local midnight (see the capture/journal/transaction forms). Server
 * components must format and compute boundaries in the same zone the user
 * lives in, otherwise a UTC server renders those instants one day early.
 *
 * The zone defaults to Asia/Bangkok to match the app's locale (THB currency,
 * Thai capture flow) and can be overridden with the APP_TIME_ZONE env var.
 */

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? "Asia/Bangkok";

/** `now` shifted so its UTC getters read the app-timezone wall clock. */
export function appNow(d: Date = new Date()): Date {
  return new Date(d.toLocaleString("en-US", { timeZone: APP_TIME_ZONE }));
}

function zoneOffsetMs(d: Date): number {
  return appNow(d).getTime() - d.getTime();
}

/** Instant of midnight (in APP_TIME_ZONE) of `d`'s wall-clock date. */
export function appDayStart(d: Date = new Date()): Date {
  const shifted = appNow(d);
  return new Date(
    Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()) -
      zoneOffsetMs(d)
  );
}

/**
 * Exclusive end of `d`'s wall-clock day. Uses calendar arithmetic on the
 * wall clock (not +24h) so DST transitions cannot shift the boundary.
 */
export function appDayEnd(d: Date = new Date()): Date {
  const shifted = appNow(d);
  return new Date(
    Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate() + 1) -
      zoneOffsetMs(d)
  );
}

export function appMonthStart(d: Date = new Date()): Date {
  const shifted = appNow(d);
  return new Date(
    Date.UTC(shifted.getFullYear(), shifted.getMonth(), 1) - zoneOffsetMs(d)
  );
}

export function appNextMonthStart(d: Date = new Date()): Date {
  const shifted = appNow(d);
  return new Date(
    Date.UTC(shifted.getFullYear(), shifted.getMonth() + 1, 1) - zoneOffsetMs(d)
  );
}

export function appYearStart(d: Date = new Date()): Date {
  const shifted = appNow(d);
  return new Date(
    Date.UTC(shifted.getFullYear(), 0, 1) - zoneOffsetMs(d)
  );
}

export function appNextYearStart(d: Date = new Date()): Date {
  const shifted = appNow(d);
  return new Date(
    Date.UTC(shifted.getFullYear() + 1, 0, 1) - zoneOffsetMs(d)
  );
}

/** Formats an instant as the wall-clock date the user sees. */
export function formatAppDate(
  d: Date | string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  return new Date(d).toLocaleDateString("en-US", {
    ...options,
    timeZone: APP_TIME_ZONE,
  });
}
