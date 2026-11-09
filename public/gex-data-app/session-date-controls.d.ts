export interface SessionDateScope { date?: string; currentDate?: string; minDate?: string; disabled?: boolean; weekdaysOnly?: boolean; closedDates?: string[]; }
export function mountSessionDateControls(options: {
  host: HTMLElement;
  popup: (anchor: HTMLElement, title: string, build: (section: HTMLElement) => void) => HTMLElement;
  getScope: () => SessionDateScope;
  onChange: (date: string) => void;
}): { sync(): void; destroy(): void };
