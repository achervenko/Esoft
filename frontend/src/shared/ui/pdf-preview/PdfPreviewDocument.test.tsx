import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PdfPreviewDocument } from './PdfPreviewDocument';
vi.mock('react-pdf', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Page: ({ pageNumber }: { pageNumber: number }) => <div data-testid="canvas-page">{pageNumber}</div>,
}));
afterEach(cleanup);
it('mounts at most five pages of a 1000-page document and supports distant navigation', () => {
  const props = { fileUrl: '/large.pdf', numberOfPages: 1000, currentPage: 1, scale: 1, rotation: 0,
    documentScrollRef: createRef<HTMLDivElement>(), pageRefs: { current: [] }, pageTextRenderers: [],
    onDocumentLoadSuccess: vi.fn(), onFirstPageLoadSuccess: vi.fn() };
  const view = render(<PdfPreviewDocument {...props} />);
  expect(screen.getAllByTestId('canvas-page').map((page) => page.textContent)).toEqual(['1', '2', '3']);
  view.rerender(<PdfPreviewDocument {...props} currentPage={500} />);
  expect(screen.getAllByTestId('canvas-page').map((page) => page.textContent)).toEqual(['498','499','500','501','502']);
  expect(view.container.querySelectorAll('[data-page-number]')).toHaveLength(1000);
});
