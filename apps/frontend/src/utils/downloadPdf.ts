import { pdf } from '@react-pdf/renderer';

type PdfDocumentElement = NonNullable<Parameters<typeof pdf>[0]>;

export async function downloadPdf(
  element: PdfDocumentElement,
  filename: string,
): Promise<void> {
  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
