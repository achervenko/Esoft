import type { PdfDocumentForViewer } from "./pdfPreview.types";

/** Limit PDF worker requests and stop scheduling pages after a viewer is closed. */
export async function indexPdfText(
  document: PdfDocumentForViewer,
  isCurrent: () => boolean,
): Promise<string[][] | null> {
  const pages: string[][] = new Array(document.numPages);
  let nextPage = 0;
  let failed = false;
  const shouldContinue = () => !failed && isCurrent();
  async function worker() {
    while (shouldContinue() && nextPage < document.numPages) {
      const index = nextPage++;
      const page = await document.getPage(index + 1);
      if (!shouldContinue()) return;
      const text = await page.getTextContent();
      if (!shouldContinue()) return;
      pages[index] = text.items.map((item) =>
        "str" in item && typeof item.str === "string" ? item.str : "",
      );
      // Let input and paint work run between pages even when promises resolve immediately.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, document.numPages) }, async () => {
    try { await worker(); }
    catch (error) { failed = true; throw error; }
  }));
  return isCurrent() ? pages : null;
}
