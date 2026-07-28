export type StrategyRuntimeProfile = {
  id: string;
  slug: string;
  label: string;
  market: string;
  version: string;
  source: "kwantmaster";
  summary: string;
};

export const strategyRuntimeProfiles: StrategyRuntimeProfile[] = [
  {
    id: "open_drive_0945_v8",
    slug: "open-drive-0945-v8",
    label: "MNQ Open Drive",
    market: "MNQ SEP26",
    version: "V8",
    source: "kwantmaster",
    summary: "Forward-test runtime, execution health, and live paper/demo state imported from KWANTMASTER.",
  },
];

export function getStrategyRuntimeProfileByIdOrSlug(value: string) {
  return strategyRuntimeProfiles.find((profile) => profile.id === value || profile.slug === value) ?? null;
}
