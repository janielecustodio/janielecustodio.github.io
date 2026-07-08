// Scans a barcode from `videoEl`'s camera feed and calls `onResult(code)`
// once. Uses the native BarcodeDetector API where available (Chrome,
// Edge, Android/Samsung Internet); falls back to the ZXing library
// (loaded from CDN, lazily, only on browsers that lack BarcodeDetector —
// notably Safari and Firefox) so the common case has zero extra download.
// Returns an async stop() to release the camera.
export async function startScan(videoEl, onResult, onError) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  let stopped = false;
  let extraStop = null;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    extraStop?.();
  };

  if ("BarcodeDetector" in window) {
    let formats;
    try {
      formats = await window.BarcodeDetector.getSupportedFormats();
    } catch {
      formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
    }
    const detector = new window.BarcodeDetector({ formats });
    const tick = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes.length > 0) {
          onResult(codes[0].rawValue);
          stop();
          return;
        }
      } catch (e) {
        onError?.(e);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else {
    try {
      const { BrowserMultiFormatReader } = await import(
        "https://esm.sh/@zxing/browser@0.1.5"
      );
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(
        videoEl,
        (result, err) => {
          if (result && !stopped) {
            onResult(result.getText());
            stop();
          }
        }
      );
      extraStop = () => controls.stop();
    } catch (e) {
      stop();
      onError?.(e);
    }
  }

  return stop;
}

export function barcodeScanningSupported() {
  return "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices;
}
