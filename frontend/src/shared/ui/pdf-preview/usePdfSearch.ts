import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { PdfDocumentForViewer } from "./pdfPreview.types";

export type PdfSearchMatch = {
  pageNumber: number;
  itemIndex: number;
  occurrenceIndex: number;
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pageTextItems, setPageTextItems] = useState<string[][]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [isIndexLoading, setIsIndexLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const indexRequestId = useRef(0);

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

  const focusSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        (event.code === "KeyF" ||
          event.key.toLowerCase() === "f" ||
          event.key.toLowerCase() === "а");

      if (!isFindShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      setIsOpen(true);
      focusSearchInput();
    };

    document.addEventListener(
      "keydown",
      handleFindShortcut,
      true,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleFindShortcut,
        true,
      );
    };
  }, [focusSearchInput]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setActiveMatchIndex(value.trim() ? 0 : -1);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveMatchIndex(-1);
  }, []);

  const goToPreviousMatch = useCallback(() => {
    if (matches.length === 0) {
      return;
    }

    setActiveMatchIndex((currentIndex) =>
      currentIndex <= 0
        ? matches.length - 1
        : currentIndex - 1,
    );
  }, [matches.length]);

  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) {
      return;
    }

    setActiveMatchIndex((currentIndex) =>
      currentIndex >= matches.length - 1
        ? 0
        : currentIndex + 1,
    );
  }, [matches.length]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setActiveMatchIndex(-1);
    inputRef.current?.focus();
  }, []);

  const resetSearch = useCallback(() => {
    indexRequestId.current += 1;

    setIsOpen(false);
    setQuery("");
    setPageTextItems([]);
    setActiveMatchIndex(-1);
    setIsIndexLoading(false);
  }, []);

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();

        if (event.shiftKey) {
          goToPreviousMatch();
        } else {
          goToNextMatch();
        }

        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      }
    },
    [
      closeSearch,
      goToNextMatch,
      goToPreviousMatch,
    ],
  );

  const indexDocument = useCallback(
    async (pdfDocument: PdfDocumentForViewer) => {
      const requestId = ++indexRequestId.current;

      setPageTextItems([]);
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

        if (requestId !== indexRequestId.current) {
          return;
        }

        setPageTextItems(pages);
      } catch (error) {
        if (requestId !== indexRequestId.current) {
          return;
        }

        console.error(
          "Не удалось создать поисковый индекс PDF:",
          error,
        );

        setPageTextItems([]);
      } finally {
        if (requestId === indexRequestId.current) {
          setIsIndexLoading(false);
        }
      }
    },
    [],
  );

  const renderText = useCallback(
    (
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

        result += [
          '<mark class="pdf-preview-search-match"',
          ` data-page-number="${pageNumber}"`,
          ` data-item-index="${itemIndex}"`,
          ` data-occurrence-index="${occurrenceIndex}">`,
          escapeHtml(match[0]),
          "</mark>",
        ].join("");

        lastIndex = matchIndex + match[0].length;
        occurrenceIndex += 1;
      }

      result += escapeHtml(text.slice(lastIndex));

      return result;
    },
    [normalizedQuery],
  );

  return {
    isOpen,
    query,
    setQuery: handleQueryChange,
    matches,
    activeMatch,
    activeMatchIndex,
    isIndexLoading,
    inputRef,
    handleInputKeyDown,
    goToPreviousMatch,
    goToNextMatch,
    closeSearch,
    clearSearch,
    resetSearch,
    indexDocument,
    renderText,
  };
}
