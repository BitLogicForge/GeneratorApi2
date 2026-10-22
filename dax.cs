using System.IO;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Parsing;

public static class PdfPublicSanitizer
{
    public static MemoryStream SanitizeBeforeMerge(Stream inputPdfStream)
    {
        using var loadedDoc = new PdfLoadedDocument(inputPdfStream);

        // 1. Flatten annotations/forms so hidden /Helv and /ZaDb references are converted to static graphics
        loadedDoc.FlattenAnnotations();
        if (loadedDoc.Form != null)
        {
            loadedDoc.Form.Flatten = true;
        }

        // 2. Purge orphaned/unused font dictionaries from pages (fixes vector-only PDFs)
        var compressOptions = new PdfCompressionOptions
        {
            OptimizePageContents = true,
            OptimizeFont = false // Do not merge/subset active fonts
        };
        loadedDoc.Compress(compressOptions);

        var output = new MemoryStream();
        loadedDoc.Save(output);
        output.Position = 0;
        return output;
    }
}