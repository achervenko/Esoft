export function printPdfUrl(fileUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const iframe = document.createElement("iframe");
    let isCleanedUp = false;

    iframe.className = "pdf-preview-print-frame";
    iframe.src = fileUrl;

    const cleanup = () => {
      if (isCleanedUp) {
        return;
      }

      isCleanedUp = true;
      window.removeEventListener("focus", cleanup);
      iframe.contentWindow?.removeEventListener("afterprint", cleanup);
      iframe.remove();
    };

    iframe.addEventListener("error", () => {
      cleanup();
      reject(new Error("PDF print frame failed to load."));
    });

    iframe.addEventListener("load", () => {
      const frameWindow = iframe.contentWindow;

      if (!frameWindow) {
        cleanup();
        reject(new Error("PDF print frame is unavailable."));
        return;
      }

      frameWindow.addEventListener("afterprint", cleanup, { once: true });

      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(() => {
        window.addEventListener("focus", cleanup, { once: true });
      }, 1000);
      window.setTimeout(cleanup, 120000);
      resolve();
    });

    document.body.append(iframe);
  });
}
