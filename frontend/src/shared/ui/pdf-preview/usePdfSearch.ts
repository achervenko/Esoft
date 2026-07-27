import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type PdfSearchMatch = {
  pageNumber: number;
  itemIndex: number;
  occurrenceIndex: number;
};

type PdfDocumentForSearch = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{
      items: Array<
        | {
            str: string;
          }
        | Record<string, unknown>
      >;
    }>;
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function usePdfSearch() {
  const [query, setQuery] = useState("");
  const [pageTextItems, setPageTextItems] = useState<string[][]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isIndexLoading, setIsIndexLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizedQuery = query.trim();

  const matches = useMemo<PdfSearchMatch[]>(() => {
    if (!normalizedQuery) {
      return [];
    }

    const expression = new RegExp(
      escapeRegExp(normalizedQuery),
      "giu",
    );

    const nextMatches: PdfSearchMatch[] = [];

    pageTextItems.forEach((items, pageIndex) => {
      items.forEach((text, itemIndex) => {
        const itemMatches = Array.from(text.matchAll(expression));

        itemMatches.forEach((_, occurrenceIndex) => {
          nextMatches.push({
            pageNumber: pageIndex + 1,
            itemIndex,
            occurrenceIndex,
          });
        });
      });
    });

    return nextMatches;
  }, [normalizedQuery, pageTextItems]);

  const activeMatch =
    activeMatchIndex >= 0
      ? matches[activeMatchIndex]
      : undefined;

  useEffect(() => {
    if (matches.length === 0) {
      setActiveMatchIndex(-1);
      return;
    }

    setActiveMatchIndex(0);
  }, [normalizedQuery, matches.length]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, []);

  const goToPreviousMatch = () => {
    if (matches.length === 0) {
      return;
    }

    setActiveMatchIndex((currentIndex) =>
      currentIndex <= 0
        ? matches.length - 1
        : currentIndex - 1,
    );
  };

  const goToNextMatch = () => {
    if (matches.length === 0) {
      return;
    }

    setActiveMatchIndex((currentIndex) =>
      currentIndex >= matches.length - 1
        ? 0
        : currentIndex + 1,
    );
  };

  const clearSearch = () => {
    setQuery("");
    setActiveMatchIndex(-1);
  };

  const resetSearch = () => {
    setQuery("");
    setPageTextItems([]);
    setActiveMatchIndex(-1);
    setIsIndexLoading(false);
  };

  const handleInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (event.shiftKey) {
        goToPreviousMatch();
      } else {
        goToNextMatch();
      }
    }

    if (event.key === "Escape") {
      clearSearch();
      inputRef.current?.blur();
    }
  };

  const indexDocument = async (
    pdfDocument: PdfDocumentForSearch,
  ) => {
    setPageTextItems([]);
    setActiveMatchIndex(-1);
    setIsIndexLoading(true);

    try {
      const pages = await Promise.all(
        Array.from(
          { length: pdfDocument.numPages },
          async (_, pageIndex) => {
            const page = await pdfDocument.getPage(pageIndex + 1);
            const textContent = await page.getTextContent();

            return textContent.items.map((item) =>
              "str" in item && typeof item.str === "string"
                ? item.str
                : "",
            );
          },
        ),
      );

      setPageTextItems(pages);
    } catch (error) {
      console.error(
        "Не удалось создать поисковый индекс PDF:",
        error,
      );

      setPageTextItems([]);
    } finally {
      setIsIndexLoading(false);
    }
  };

  const renderText = (
    text: string,
    pageNumber: number,
    itemIndex: number,
  ) => {
    if (!normalizedQuery) {
      return escapeHtml(text);
    }

    const expression = new RegExp(
      escapeRegExp(normalizedQuery),
      "giu",
    );

    let result = "";
    let lastIndex = 0;
    let occurrenceIndex = 0;

    for (const match of text.matchAll(expression)) {
      const matchIndex = match.index;

      if (matchIndex === undefined) {
        continue;
      }

      result += escapeHtml(
        text.slice(lastIndex, matchIndex),
      );

      const isActive =
        activeMatch?.pageNumber === pageNumber &&
        activeMatch.itemIndex === itemIndex &&
        activeMatch.occurrenceIndex === occurrenceIndex;

      const className = isActive
        ? "pdf-preview-search-match pdf-preview-search-match-active"
        : "pdf-preview-search-match";

      result += `<mark class="${className}">${escapeHtml(
        match[0],
      )}</mark>`;

      lastIndex = matchIndex + match[0].length;
      occurrenceIndex += 1;
    }

    result += escapeHtml(text.slice(lastIndex));

    return result;
  };

  return {
    query,
    setQuery,
    matches,
    activeMatch,
    activeMatchIndex,
    isIndexLoading,
    inputRef,
    handleInputKeyDown,
    goToPreviousMatch,
    goToNextMatch,
    clearSearch,
    resetSearch,
    indexDocument,
    renderText,
  };
}