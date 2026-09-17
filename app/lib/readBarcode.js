import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

const BARCODE_FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
];

const NATIVE_1D = [
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
];

const nativeDetectors = {};

function hintsFor(mode) {
  const hints = new Map();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    mode === "qr" ? [BarcodeFormat.QR_CODE] : BARCODE_FORMATS
  );
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

function createZxingReader(mode) {
  const reader = new MultiFormatReader();
  reader.setHints(hintsFor(mode));
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

function drawVideoRegion(video, canvas, mode, { fullFrame = false } = {}) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return false;

  let sx;
  let sy;
  let sw;
  let sh;
  if (fullFrame) {
    sx = 0;
    sy = 0;
    sw = width;
    sh = height;
  } else if (mode === "qr") {
    const size = Math.floor(Math.min(width, height) * 0.64);
    sx = Math.floor((width - size) / 2);
    sy = Math.floor((height - size) / 2);
    sw = size;
    sh = size;
  } else {
    sx = Math.floor(width * 0.04);
    sy = Math.floor(height * 0.38);
    sw = Math.floor(width * 0.92);
    sh = Math.max(48, Math.floor(height * 0.24));
  }

  canvas.width = mode === "qr" ? Math.min(900, sw) : Math.min(1400, sw);
  canvas.height = Math.max(80, Math.round((canvas.width * sh) / sw));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return true;
}

async function detectNative(video, mode) {
  if (typeof window === "undefined" || !window.BarcodeDetector) return "";
  try {
    if (!nativeDetectors[mode]) {
      nativeDetectors[mode] = new window.BarcodeDetector({
        formats: mode === "qr" ? ["qr_code"] : NATIVE_1D,
      });
    }
    const codes = await nativeDetectors[mode].detect(video);
    return codes?.[0]?.rawValue?.trim() || "";
  } catch {
    nativeDetectors[mode] = null;
    return "";
  }
}

export function createBarcodeLoopReader(mode = "barcode") {
  return createZxingReader(mode);
}

export async function detectBarcodeFromVideo(video, canvas, reader, mode = "barcode") {
  if (!video || video.readyState < 2) return "";

  const nativeText = await detectNative(video, mode);
  if (nativeText) return nativeText;

  const zxing = reader || createZxingReader(mode);
  if (!canvas) return "";

  if (drawVideoRegion(video, canvas, mode)) {
    const regionText = decodeSource(zxing, canvasToLuminance(canvas));
    if (regionText) return regionText;
  }

  if (drawVideoRegion(video, canvas, mode, { fullFrame: true })) {
    return decodeSource(zxing, canvasToLuminance(canvas));
  }

  return "";
}
