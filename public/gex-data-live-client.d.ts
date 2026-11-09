export function createGexDataLiveClient(options: {
  createSource: (url: string) => EventSource;
  onFrame?: (detail: { consumer: string; url: string }) => void;
}): {
  request(url: string, options: RequestInit, consumer?: string): Promise<Response> | null;
  release(consumer: string): void;
  pause(): void;
  dispose(): void;
  status(): { selections: number; owners: number; bytes: number };
};
