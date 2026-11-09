export const TOOL_CONFIGURATION_OPTIONS: readonly Readonly<{key: string; label: string}>[];
export function sanitizeToolConfiguration(value: unknown): Record<string, boolean>;
