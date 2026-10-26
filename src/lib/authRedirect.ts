/** Keep OAuth return destinations inside this website, including after URL
 * parsers normalize backslashes and whitespace. */
export const OAUTH_RETURN_COOKIE = "kwantdesk-oauth-return";

export function safeAuthReturn(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")
      || value.length > 2000 || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  return value;
}
