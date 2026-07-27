export type TextRendererParams = {
  str: string;
  itemIndex: number;
};

export type PdfPageForViewer = {
  getViewport: (options: { scale: number }) => {
    width: number;
  };
};

type PdfTextContentItem =
  | {
      str: string;
    }
  | Record<string, unknown>;

type PdfPageForTextSearch = {
  getTextContent: () => Promise<{
    items: PdfTextContentItem[];
  }>;
};

export type PdfDocumentForViewer = {
  numPages: number;
  getPage: (
    pageNumber: number,
  ) => Promise<PdfPageForTextSearch>;
};
