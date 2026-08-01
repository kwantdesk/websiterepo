export const ZYON_GAMEPLAN_LAUNCH_PARAM = "gameplan";

export const ZYON_GAMEPLAN_START_MESSAGE = "Hey Zyon, let’s make a Gameplan.";

export function zyonGameplanLaunchHref() {
  return `/zyon?launch=${ZYON_GAMEPLAN_LAUNCH_PARAM}`;
}
