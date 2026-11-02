/** Finite JSON history pages may exceed a buffered function response limit. */
export function chunkedJsonBody(json: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(json);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(bytes.length, offset + 64 * 1024);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}
