import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

const BARCODE_HINTS = new Map();
BARCODE_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE,
]);
BARCODE_HINTS.set(DecodeHintType.TRY_HARDER, true);

const NATIVE_FORMATS = [
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "qr_code",
];

let nativeDetector;

function createZxingReader() {
  const reader = new MultiFormatReader();
  reader.setHints(BARCODE_HINTS);
  return reader;
}

function canvasToLuminance(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);
  const luminances = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    luminances[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return new RGBLuminanceSource(luminances, width, height);
}

function decodeSource(reader, source) {
  const attempts = [
    () => reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(source))),
    () => reader.decodeWithState(new BinaryBitmap(new GlobalHistogramBinarizer(source))),
    () => reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(source.invert()))),
  ];
  for (const attempt of attempts) {
    try {
      const text = attempt()?.getText?.()?.trim();
      if (text) return text;
    } catch {
      /* keep trying */
    }
  }
  return "";
}

function drawVideoStrip(video, canvas, { fullFrame = false } = {}) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return false;

  const sx = fullFrame ? 0 : Math.floor(width * 0.04);
  const sy = fullFrame ? 0 : Math.floor(height * 0.38);
  const sw = fullFrame ? width : Math.floor(width * 0.92);
  const sh = fullFrame ? height : Math.max(48, Math.floor(height * 0.24));

  canvas.width = Math.min(1400, sw);
  canvas.height = Math.max(80, Math.round((canvas.width * sh) / sw));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return true;
}

async function detectNative(video) {
  if (typeof window === "undefined" || !window.BarcodeDetector) return "";
  try {
    if (!nativeDetector) {
      nativeDetector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
    }
    const codes = await nativeDetector.detect(video);
    return codes?.[0]?.rawValue?.trim() || "";
  } catch {
    nativeDetector = null;
    return "";
  }
}

export function createBarcodeLoopReader() {
  return createZxingReader();
}

export async function detectBarcodeFromVideo(video, canvas, reader) {
  if (!video || video.readyState < 2) return "";

  const nativeText = await detectNative(video);
  if (nativeText) return nativeText;

  const zxing = reader || createZxingReader();
  if (!canvas) return "";

  if (drawVideoStrip(video, canvas)) {
    const stripText = decodeSource(zxing, canvasToLuminance(canvas));
    if (stripText) return stripText;
  }

  if (drawVideoStrip(video, canvas, { fullFrame: true })) {
    return decodeSource(zxing, canvasToLuminance(canvas));
  }

  return "";
}
