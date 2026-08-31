import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import {
  ZyonTranscriptionService,
  zyonTranscriptionContract,
} from "../src/zyon-transcription-service.mjs";

const subject = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const apiKey = "openai-server-only-credential";

function wave(durationMilliseconds = 250) {
  const pcmBytes = Math.floor(16_000 * 2 * durationMilliseconds / 1_000);
  const value = Buffer.alloc(44 + pcmBytes);
  value.write("RIFF", 0, "ascii");
  value.writeUInt32LE(value.length - 8, 4);
  value.write("WAVE", 8, "ascii");
  value.write("fmt ", 12, "ascii");
  value.writeUInt32LE(16, 16);
  value.writeUInt16LE(1, 20);
  value.writeUInt16LE(1, 22);
  value.writeUInt32LE(16_000, 24);
  value.writeUInt32LE(32_000, 28);
  value.writeUInt16LE(2, 32);
  value.writeUInt16LE(16, 34);
  value.write("data", 36, "ascii");
  value.writeUInt32LE(pcmBytes, 40);
  return value;
}

function request(payload = wave(), headers = {}) {
  const stream = Readable.from(payload?.length ? [Buffer.from(payload)] : []);
  stream.method = "POST";
  stream.headers = {
    "content-type": "audio/wav",
    "x-kwantdesk-speech-language": "en-AU",
    ...headers,
  };
  return stream;
}

function responseRecorder() {
  return {
    status: null,
    headers: null,
    chunks: [],
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(chunk) {
      if (chunk) this.chunks.push(Buffer.from(chunk));
    },
    json() { return JSON.parse(Buffer.concat(this.chunks).toString("utf8")); },
  };
}

test("transcribes exact bounded audio with the VPS-only provider credential", async () => {
  let captured;
  const service = new ZyonTranscriptionService({
    apiKey,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response('{"text":"NQ held VWAP. Wait for delta confirmation."}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const response = responseRecorder();

  await service.handle(request(), response, { subject });

  assert.equal(response.status, 200);
  assert.deepEqual(response.json(), {
    transcript: "NQ held VWAP. Wait for delta confirmation.",
    model: zyonTranscriptionContract.defaultModel,
    durationSeconds: 0.25,
  });
  assert.equal(captured.url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal(captured.init.headers.Authorization, `Bearer ${apiKey}`);
  assert.equal(captured.init.headers.authorization, undefined);
  assert.ok(captured.init.body instanceof FormData);
  assert.equal(captured.init.body.get("model"), zyonTranscriptionContract.defaultModel);
  assert.equal(captured.init.body.get("language"), "en");
  assert.equal(captured.init.body.get("response_format"), "json");
  const file = captured.init.body.get("file");
  assert.equal(file.name, "dictation.wav");
  assert.equal(file.type, "audio/wav");
  assert.equal(file.size, wave().length);
  assert.deepEqual(service.health(), { configured: true, model: zyonTranscriptionContract.defaultModel });
  assert.doesNotMatch(JSON.stringify(service.health()), new RegExp(apiKey));
});

test("fails closed for absent identity, configuration, bad media, language, and oversized declarations", async () => {
  let calls = 0;
  const service = new ZyonTranscriptionService({
    apiKey,
    fetchImpl: async () => { calls += 1; return new Response('{}'); },
  });
  await assert.rejects(
    service.handle(request(), responseRecorder(), null),
    (error) => error.code === "zyon_transcription_identity_required" && error.status === 401,
  );
  await assert.rejects(
    new ZyonTranscriptionService().handle(request(), responseRecorder(), { subject }),
    (error) => error.code === "zyon_transcription_unconfigured" && error.status === 503,
  );

  const wrongRate = wave();
  wrongRate.writeUInt32LE(44_100, 24);
  const invalidBodies = [Buffer.from("not-wave"), wrongRate, Buffer.alloc(44)];
  for (const invalid of invalidBodies) {
    await assert.rejects(
      service.handle(request(invalid), responseRecorder(), { subject }),
      (error) => error.code === "zyon_transcription_invalid_audio" && error.status === 400,
    );
  }
  await assert.rejects(
    service.handle(
      request(wave(), { "content-length": String(zyonTranscriptionContract.maximumWaveBytes + 1) }),
      responseRecorder(),
      { subject },
    ),
    (error) => error.code === "zyon_transcription_too_large" && error.status === 413,
  );
  await assert.rejects(
    service.handle(
      request(wave(), { "x-kwantdesk-speech-language": "../../secret" }),
      responseRecorder(),
      { subject },
    ),
    (error) => error.code === "zyon_transcription_invalid_language" && error.status === 400,
  );
  await assert.rejects(
    service.handle(
      request(wave(), { "content-type": "application/json" }),
      responseRecorder(),
      { subject },
    ),
    (error) => error.code === "zyon_transcription_content_type" && error.status === 415,
  );
  assert.equal(calls, 0);
});

test("rejects non-JSON provider receipts, empty speech, and unapproved model configuration", async () => {
  assert.throws(
    () => new ZyonTranscriptionService({ apiKey, model: "caller-selected-model" }),
    /not allow-listed/,
  );
  for (const [providerResponse, code] of [
    [new Response("plain text", { status: 200, headers: { "Content-Type": "text/plain" } }), "zyon_transcription_malformed"],
    [new Response('{"text":""}', { status: 200, headers: { "Content-Type": "application/json" } }), "zyon_transcription_no_speech"],
    [new Response('{"error":"quota"}', { status: 429, headers: { "Content-Type": "application/json" } }), "zyon_transcription_rate_limited"],
  ]) {
    const service = new ZyonTranscriptionService({
      apiKey,
      fetchImpl: async () => providerResponse,
    });
    await assert.rejects(
      service.handle(request(), responseRecorder(), { subject }),
      (error) => error.code === code,
    );
  }
});

test("route matching is exact and does not create an open provider proxy", () => {
  const service = new ZyonTranscriptionService({ apiKey });
  assert.equal(service.canHandle("POST", "/v1/zyon/transcriptions"), true);
  assert.equal(service.canHandle("GET", "/v1/zyon/transcriptions"), false);
  assert.equal(service.canHandle("POST", "/v1/zyon/transcriptions/"), false);
  assert.equal(service.canHandle("POST", "https://api.openai.com/v1/audio/transcriptions"), false);
});
