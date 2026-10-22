using System.IO;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Parsing;

public static MemoryStream ConvertExistingMergedDocToPdfA(
    PdfDocument mergedDocument,
    byte[] fallbackTtfBytes,
    bool hasOnlyVectors = false)
{
    mergedDocument.FileStructure.IncrementalUpdate = false;

    // 1. Save the PdfDocument to a stream
    using (var rawMergedStream = new MemoryStream())
    {
        mergedDocument.Save(rawMergedStream);
        rawMergedStream.Position = 0;

        // 2. Run LegacyPdfFontFixer to flatten forms/annotations & strip ghost fonts
        using (MemoryStream sanitizedStream = LegacyPdfFontFixer.SanitizeAndFixFonts(rawMergedStream, hasOnlyVectors))
        {
            // 3. Load sanitized stream and convert to PDF/A
            using (var loadedDoc = new PdfLoadedDocument(sanitizedStream))
            {
                loadedDoc.SubstituteFont += (sender, args) =>
                {
                    args.FontStream = new MemoryStream(fallbackTtfBytes, writable: false);
                };

                // Use Pdf_A1B or Pdf_A2B depending on your legacy Syncfusion enum support
                loadedDoc.Conformance = PdfConformanceLevel.Pdf_A1B;

                var finalPdfAStream = new MemoryStream();
                loadedDoc.Save(finalPdfAStream);
                finalPdfAStream.Position = 0;
                return finalPdfAStream;
            }
        }
    }
}