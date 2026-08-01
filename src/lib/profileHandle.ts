export const PROFILE_HANDLE_REQUIREMENTS =
  "Use 3–24 characters, start with a letter, include at least three letters, and only use letters, numbers or underscores.";

export function isValidProfileHandle(value: string) {
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(value)) return false;
  return (value.match(/[a-z]/g) ?? []).length >= 3;
}
