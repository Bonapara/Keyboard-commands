export const COMMAND_SPLITTER_REGEX = /[\s,]+/;
export const COMMAND_PART_REGEX = /^(-(?![\d])|(-)?[\p{L}]+(-[\p{L}]+)*?)(?=\s|[\d]|-[\d]|-$|$|#|:|$|@)/u;

export const COMMAND_BREAK_PATTERN = /\s{2,}/;

export const VALUE_FORMAT_REGEX = {
  number: /-?\s*\(?(\d+(\.\d+)?(?:\s*[-+*/x]\s*\(?-?\d+(\.\d+)?\)?)*\)?%?)/,
  hex: /#[0-9a-fA-F]{0,6}/,
  string: /.+/,
} as const;

export const CACHE_DURATION = 300_000;

export const EXPORT_TIMEOUT = 10_000;

export const DEFAULT_BORDER_WIDTH = 1;
export const MIN_SCALE_FACTOR = 0.01;
