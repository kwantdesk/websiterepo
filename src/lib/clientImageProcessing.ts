"use client";

export type PreparedClientImage = {
  dataUrl: string;
  width: number;
  height: number;
  size: number;
  type: "image/webp";
  name: string;
};

type EncodeCanvasOptions = {
  maxBytes: number;
  initialQuality?: number;
  minimumQuality?: number;
};

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function webpName(value: string) {
  const base = value.trim().replace(/\.[^.]+$/, "").slice(0, 110) || "image";
  return `${base}.webp`;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("The prepared image could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function imageElement(file: File) {
  const sourceUrl = URL.createObjectURL(file);
  const image = new window.Image();
  image.decoding = "async";
  image.src = sourceUrl;
  try {
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("That image has no usable dimensions.");
    }
    return { image, sourceUrl };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error;
  }
}

export async function encodeCanvasImage(
  canvas: HTMLCanvasElement,
  {
    maxBytes,
    initialQuality = 0.94,
    minimumQuality = 0.78,
  }: EncodeCanvasOptions,
) {
  let quality = initialQuality;
  let blob = await canvasBlob(canvas, quality);
  while (blob && blob.size > maxBytes && quality > minimumQuality) {
    quality = Math.max(minimumQuality, quality - 0.04);
    blob = await canvasBlob(canvas, quality);
  }
  if (!blob) throw new Error("This browser could not prepare the image.");
  if (blob.size > maxBytes) {
    throw new Error("The image contains too much detail to prepare within the upload limit.");
  }
  return {
    dataUrl: await blobDataUrl(blob),
    size: blob.size,
    type: "image/webp" as const,
  };
}

function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a PNG, JPG, WebP, or GIF image.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose an image smaller than 20 MB.");
}

export async function prepareSquareImage(
  file: File,
  {
    size = 1080,
    maxBytes = 1_100_000,
  }: {
    size?: number;
    maxBytes?: number;
  } = {},
): Promise<PreparedClientImage> {
  validateImageFile(file);
  const { image, sourceUrl } = await imageElement(file);
  try {
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size,
    );
    const encoded = await encodeCanvasImage(canvas, { maxBytes });
    return {
      ...encoded,
      width: size,
      height: size,
      name: webpName(file.name),
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function prepareSharedImage(
  file: File,
  {
    maximumEdge = 1920,
    maxBytes = 900_000,
  }: {
    maximumEdge?: number;
    maxBytes?: number;
  } = {},
): Promise<PreparedClientImage> {
  validateImageFile(file);
  const { image, sourceUrl } = await imageElement(file);
  try {
    const scale = Math.min(1, maximumEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    const encoded = await encodeCanvasImage(canvas, { maxBytes });
    return {
      ...encoded,
      width,
      height,
      name: webpName(file.name),
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
