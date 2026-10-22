using System;
using System.IO;
using System.Linq;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Parsing;
using Syncfusion.Pdf.Primitives;

public static class PdfFontPrefixFixer
{
    /// <summary>
    /// Rewrites /BaseFont and /FontName in each source PDF with a unique prefix
    /// so PdfMergeOptions.OptimizeResources = true deduplicates images without colliding fonts.
    /// </summary>
    public static MemoryStream MakeFontNamesUnique(Stream inputPdfStream)
    {
        using var loadedDoc = new PdfLoadedDocument(inputPdfStream);
        string uniqueTag = GenerateSubsetPrefix(); // e.g., "QWERAS+"

        foreach (PdfLoadedPage page in loadedDoc.Pages)
        {
            if (page.Dictionary.ContainsKey("Resources"))
            {
                var resources = PdfCrossTable.Dereference(page.Dictionary["Resources"]) as PdfDictionary;
                UniquifyFontsInResources(resources, uniqueTag);
            }
        }

        var output = new MemoryStream();
        loadedDoc.Save(output);
        output.Position = 0;
        return output;
    }

    private static void UniquifyFontsInResources(PdfDictionary? resources, string prefix)
    {
        if (resources == null) return;

        // 1. Rename fonts in the page's /Font dictionary
        if (resources.ContainsKey("Font"))
        {
            if (PdfCrossTable.Dereference(resources["Font"]) is PdfDictionary fontDict)
            {
                foreach (var key in fontDict.Keys)
                {
                    if (PdfCrossTable.Dereference(fontDict[key]) is PdfDictionary font)
                    {
                        PrefixFontDictionary(font, prefix);
                    }
                }
            }
        }

        // 2. Also check Form XObjects (templates/stamps/headers often have their own nested /Resources)
        if (resources.ContainsKey("XObject"))
        {
            if (PdfCrossTable.Dereference(resources["XObject"]) is PdfDictionary xObjectDict)
            {
                foreach (var key in xObjectDict.Keys)
                {
                    if (PdfCrossTable.Dereference(xObjectDict[key]) is PdfDictionary xObj &&
                        xObj.ContainsKey("Resources"))
                    {
                        var nestedRes = PdfCrossTable.Dereference(xObj["Resources"]) as PdfDictionary;
                        UniquifyFontsInResources(nestedRes, prefix);
                    }
                }
            }
        }
    }

    private static void PrefixFontDictionary(PdfDictionary font, string prefix)
    {
        // Update /BaseFont on the Font object
        if (font.ContainsKey("BaseFont") && PdfCrossTable.Dereference(font["BaseFont"]) is PdfName baseFont)
        {
            string cleanName = StripExistingPrefix(baseFont.Value);
            font["BaseFont"] = new PdfName(prefix + cleanName);
        }

        // Update /FontName inside /FontDescriptor (if present)
        if (font.ContainsKey("FontDescriptor") &&
            PdfCrossTable.Dereference(font["FontDescriptor"]) is PdfDictionary descriptor)
        {
            if (descriptor.ContainsKey("FontName") && PdfCrossTable.Dereference(descriptor["FontName"]) is PdfName fontName)
            {
                string cleanName = StripExistingPrefix(fontName.Value);
                descriptor["FontName"] = new PdfName(prefix + cleanName);
            }
        }

        // Handle Type0 (CID / Composite) fonts which have a /DescendantFonts array
        if (font.ContainsKey("DescendantFonts") &&
            PdfCrossTable.Dereference(font["DescendantFonts"]) is PdfArray descendants)
        {
            for (int i = 0; i < descendants.Count; i++)
            {
                if (PdfCrossTable.Dereference(descendants[i]) is PdfDictionary cidFont)
                {
                    PrefixFontDictionary(cidFont, prefix);
                }
            }
        }
    }

    private static string StripExistingPrefix(string fontName)
    {
        // Standard PDF subset prefixes are 6 uppercase letters followed by '+'
        if (fontName.Length > 7 && fontName[6] == '+')
            return fontName.Substring(7);
        return fontName;
    }

    private static string GenerateSubsetPrefix()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray()) + "+";
    }
}