import { promisify } from "node:util";
import { gzip } from "node:zlib";

const compress = promisify(gzip);
const compressedBodies = new WeakMap();

export async function sendBufferedResponse(request, response, entry) {
  if (response.destroyed) return;
  const headers = { ...entry.headers };
  let body = entry.body;
  const acceptsGzip = String(request?.headers?.["accept-encoding"] || "")
    .split(",").some((part) => /^gzip(?:\s*;|\s*$)/i.test(part.trim())
      && !/;\s*q=0(?:\.0*)?(?:\s*$|\s*;)/i.test(part));
  if (body.length >= 1024 && !headers["Content-Encoding"] && acceptsGzip) {
    let pending = compressedBodies.get(body);
    if (!pending) {
      pending = compress(body, { level: 1 });
      compressedBodies.set(body, pending);
    }
    try {
      const zipped = await pending;
      if (zipped.length < body.length) {
        body = zipped;
        headers["Content-Encoding"] = "gzip";
      }
    } catch {
      compressedBodies.delete(body);
    }
  }
  if (response.destroyed) return;
  headers.Vary = headers.Vary ? `${headers.Vary}, Accept-Encoding` : "Accept-Encoding";
  headers["Content-Length"] = String(body.length);
  response.writeHead(entry.status, headers);
  response.end(body);
}
