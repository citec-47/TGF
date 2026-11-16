"use client";

import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { useEffect } from "react";

type PdfPageRendererWindow = Window & {
  tgfRenderPdfPage?: (
    canvas: HTMLCanvasElement,
    fileUrl: string,
    pageNumber: number,
  ) => Promise<void>;
};

const documents = new Map<string, Promise<PDFDocumentProxy>>();
const renderSequences = new WeakMap<HTMLCanvasElement, number>();
const renderTasks = new WeakMap<HTMLCanvasElement, RenderTask>();

async function loadPdf(fileUrl: string): Promise<PDFDocumentProxy> {
  let documentPromise = documents.get(fileUrl);
  if (!documentPromise) {
    documentPromise = fetch(fileUrl, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The assigned PDF could not be loaded.");
        const data = new Uint8Array(await response.arrayBuffer());
        return getDocument({ data }).promise;
      })
      .catch((error: unknown) => {
        documents.delete(fileUrl);
        throw error;
      });
    documents.set(fileUrl, documentPromise);
  }
  return documentPromise;
}

async function renderPdfPage(
  canvas: HTMLCanvasElement,
  fileUrl: string,
  pageNumber: number,
): Promise<void> {
  const sequence = (renderSequences.get(canvas) || 0) + 1;
  renderSequences.set(canvas, sequence);
  renderTasks.get(canvas)?.cancel();

  const pdf = await loadPdf(fileUrl);
  if (renderSequences.get(canvas) !== sequence) return;
  if (pageNumber > pdf.numPages) {
    throw new Error("This PDF does not contain the assigned page.");
  }

  const page = await pdf.getPage(pageNumber);
  if (renderSequences.get(canvas) !== sequence) return;
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = canvas.parentElement?.clientWidth || baseViewport.width;
  const scale = Math.min(availableWidth / baseViewport.width, 1.5);
  const outputScale = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * outputScale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the PDF page preview.");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${Math.ceil(baseViewport.width * scale)}px`;
  canvas.style.height = `${Math.ceil(baseViewport.height * scale)}px`;
  canvas.setAttribute("aria-label", `Assigned PDF page ${pageNumber}`);

  const task = page.render({ canvasContext: context, viewport });
  renderTasks.set(canvas, task);
  try {
    await task.promise;
  } catch (error) {
    if (renderSequences.get(canvas) === sequence) throw error;
  } finally {
    if (renderSequences.get(canvas) === sequence) renderTasks.delete(canvas);
  }
}

export default function PdfPageRenderer() {
  useEffect(() => {
    GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    const target = window as PdfPageRendererWindow;
    target.tgfRenderPdfPage = renderPdfPage;
    document.dispatchEvent(new Event("tgf-pdf-renderer-ready"));

    return () => {
      delete target.tgfRenderPdfPage;
    };
  }, []);

  return null;
}
