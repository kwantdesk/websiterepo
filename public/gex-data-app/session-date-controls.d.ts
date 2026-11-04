export interface SessionDateScope { date?: string; currentDate?: string; disabled?: boolean; }
export function mountSessionDateControls(options: {
  host: HTMLElement;
  popup: (anchor: HTMLElement, title: string, build: (section: HTMLElement) => void) => HTMLElement;
  getScope: () => SessionDateScope;
  onChange: (date: string) => void;
}): { sync(): void; destroy(): void };
