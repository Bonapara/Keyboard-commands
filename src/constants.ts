// ==========================
// Constants
// ==========================

// Regex Constants
export const COMMAND_SPLITTER_REGEX = /[\s,]+/;
export const COMMAND_PART_REGEX = /^(-(?![\d])|(-)?[\p{L}]+(-[\p{L}]+)*?)(?=\s|[\d]|-[\d]|-$|$|#|:|\$|@)/u;

export const VALUE_FORMAT_REGEX = {
  number: /-?\s*\(?(\d+(\.\d+)?(?:\s*[-+*/x]\s*\(?-?\d+(\.\d+)?\)?)*\)?%?)/,
  hex: /#[0-9a-fA-F]{0,6}/,
} as const;

// Cache Configuration
export const CACHE_DURATION = 60_000; // 60 seconds

// Notification Timeouts
export const EXPORT_TIMEOUT = 10_000; // 10 seconds

// Default Values
export const DEFAULT_BORDER_WIDTH = 1;
export const MIN_SCALE_FACTOR = 0.01;

