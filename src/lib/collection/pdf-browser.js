// pdf.js for the browser, loaded with a dynamic import only when a PDF is imported. Both the
// library and its worker are bundled into this site's own files: nothing is fetched from a CDN.
import * as pdfjs from "pdfjs-dist/build/pdf.min.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// One pdf.js worker for every import on the page, so its script is fetched once.
let shared = null;
export function pdfWorker() {
  if (!shared) shared = new pdfjs.PDFWorker({ verbosity: 0 });
  return shared;
}

export { pdfjs };
