// Strict flag parsing, so a mistyped flag stops the run instead of being ignored.
export function parseFlags(argv, allowed) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--') || !allowed.includes(flag.slice(2))) {
      throw new Error(`unknown argument: ${flag}`);
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${flag}`);
    }
    flags[flag.slice(2)] = value;
  }
  return flags;
}

export function parseCount(flags, name, fallback) {
  if (flags[name] === undefined) return fallback;
  const value = Number(flags[name]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a whole number`);
  }
  return value;
}
