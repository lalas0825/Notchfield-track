/**
 * Logger — dev-guarded info, always-on warn/error.
 * Use logger.info() instead of console.log() everywhere in src/.
 */

export const logger = {
  info: (...args: unknown[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },

  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
