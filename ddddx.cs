using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Reflection;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Interactive;
using Syncfusion.Pdf.Parsing;

public static class LegacyPdfFontFixer
{
    private static readonly Assembly SyncfusionAssembly = typeof(PdfLoadedDocument).Assembly;
    private static readonly Type PdfCrossTableType = SyncfusionAssembly.GetType("Syncfusion.Pdf.Parsing.PdfCrossTable");
    private static readonly Type PdfDictionaryType = SyncfusionAssembly.GetType("Syncfusion.Pdf.Primitives.PdfDictionary");
    private static readonly Type PdfNameType = SyncfusionAssembly.GetType("Syncfusion.Pdf.Primitives.PdfName");
    private static readonly Type PdfArrayType = SyncfusionAssembly.GetType("Syncfusion.Pdf.Primitives.PdfArray");
    private static readonly MethodInfo DereferenceMethod = PdfCrossTableType?.GetMethod(
        "Dereference",
        BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);

    /// <summary>
    /// Compatible with older Syncfusion versions:
    /// 1. Flattens forms and page annotations via legacy APIs.
    /// 2. Optionally strips /Font dictionaries from vector-only PDFs so SubstituteFont never fires.
    /// 3. Prefixes /BaseFont and /FontName so OptimizeResources = true won't collide subsets.
    /// </summary>
    public static MemoryStream SanitizeAndFixFonts(Stream inputPdfStream, bool isVectorOnlyPdf = false)
    {
        // In older Syncfusion, pass stream directly and create a new output MemoryStream
        using (var loadedDoc = new PdfLoadedDocument(inputPdfStream))
        {
            loadedDoc.FileStructure.IncrementalUpdate = false;

            // 1. Legacy Form Flattening (removes /AcroForm default /Helv and /ZaDb font references)
            if (loadedDoc.Form != null)
            {
                loadedDoc.Form.Flatten = true;
            }

            // Also remove raw /AcroForm entry from Catalog if it still lingers after flattening
            var catalog = GetProperty(loadedDoc, "Catalog");
            if (DictContainsKey(catalog, "AcroForm"))
            {
                RemoveDictKey(catalog, "AcroForm");
            }

            string uniqueTag = GenerateSubsetPrefix();

            // 2. Iterate pages using legacy compatibility
            for (int i = 0; i < loadedDoc.Pages.Count; i++)
            {
                PdfPageBase page = loadedDoc.Pages[i];

                // Legacy Annotation Flattening (per-page iteration instead of loadedDoc.FlattenAnnotations())
                if (page is PdfLoadedPage loadedPage && loadedPage.Annotations != null)
                {
                    loadedPage.Annotations.Flatten = true;
                }

                // Access internal page.Dictionary
                var pageDict = GetProperty(page, "Dictionary");
                if (DictContainsKey(pageDict, "Resources"))
                {
                    var resources = Dereference(GetDictItem(pageDict, "Resources"));
                    ProcessResources(resources, uniqueTag, isVectorOnlyPdf);
                }
            }

            var output = new MemoryStream();
            loadedDoc.Save(output);
            output.Position = 0;
            return output;
        }
    }

    private static void ProcessResources(object resources, string prefix, bool stripFontsCompletely)
    {
        if (resources == null || !IsType(resources, PdfDictionaryType)) return;

        if (DictContainsKey(resources, "Font"))
        {
            if (stripFontsCompletely)
            {
                // Vector-only PDF: Remove the /Font dictionary entirely so SubstituteFont NEVER triggers!
                RemoveDictKey(resources, "Font");
            }
            else
            {
                var fontDict = Dereference(GetDictItem(resources, "Font"));
                if (IsType(fontDict, PdfDictionaryType))
                {
                    foreach (var key in GetDictKeys(fontDict))
                    {
                        var font = Dereference(GetDictItemByKeyObj(fontDict, key));
                        if (IsType(font, PdfDictionaryType))
                        {
                            PrefixFontDictionary(font, prefix);
                        }
                    }
                }
            }
        }

        // Also process nested Form XObjects (vector stamps/templates often hide fonts here)
        if (DictContainsKey(resources, "XObject"))
        {
            var xObjectDict = Dereference(GetDictItem(resources, "XObject"));
            if (IsType(xObjectDict, PdfDictionaryType))
            {
                foreach (var key in GetDictKeys(xObjectDict))
                {
                    var xObj = Dereference(GetDictItemByKeyObj(xObjectDict, key));
                    if (IsType(xObj, PdfDictionaryType) && DictContainsKey(xObj, "Resources"))
                    {
                        var nestedRes = Dereference(GetDictItem(xObj, "Resources"));
                        ProcessResources(nestedRes, prefix, stripFontsCompletely);
                    }
                }
            }
        }
    }

    private static void PrefixFontDictionary(object font, string prefix)
    {
        if (DictContainsKey(font, "BaseFont"))
        {
            var baseFont = Dereference(GetDictItem(font, "BaseFont"));
            if (IsType(baseFont, PdfNameType))
            {
                string currentVal = GetProperty(baseFont, "Value") as string ?? "";
                string cleanName = StripExistingPrefix(currentVal);
                SetDictItem(font, "BaseFont", CreatePdfName(prefix + cleanName));
            }
        }

        if (DictContainsKey(font, "FontDescriptor"))
        {
            var descriptor = Dereference(GetDictItem(font, "FontDescriptor"));
            if (IsType(descriptor, PdfDictionaryType) && DictContainsKey(descriptor, "FontName"))
            {
                var fontName = Dereference(GetDictItem(descriptor, "FontName"));
                if (IsType(fontName, PdfNameType))
                {
                    string currentVal = GetProperty(fontName, "Value") as string ?? "";
                    string cleanName = StripExistingPrefix(currentVal);
                    SetDictItem(descriptor, "FontName", CreatePdfName(prefix + cleanName));
                }
            }
        }

        if (DictContainsKey(font, "DescendantFonts"))
        {
            var descendants = Dereference(GetDictItem(font, "DescendantFonts"));
            if (IsType(descendants, PdfArrayType) && descendants is IEnumerable enumerable)
            {
                foreach (var item in enumerable)
                {
                    var cidFont = Dereference(item);
                    if (IsType(cidFont, PdfDictionaryType))
                    {
                        PrefixFontDictionary(cidFont, prefix);
                    }
                }
            }
        }
    }

    // --- Reflection Helpers ---

    private static object Dereference(object primitive) =>
        primitive == null ? null : DereferenceMethod?.Invoke(null, new[] { primitive });

    private static bool IsType(object obj, Type targetType) =>
        obj != null && targetType != null && targetType.IsInstanceOfType(obj);

    private static object GetProperty(object target, string propName) =>
        target?.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(target);

    private static bool DictContainsKey(object dict, string key)
    {
        if (dict == null) return false;
        var method = dict.GetType().GetMethod("ContainsKey", new[] { typeof(string) });
        return (bool)(method?.Invoke(dict, new object[] { key }) ?? false);
    }

    private static void RemoveDictKey(object dict, string key)
    {
        if (dict == null) return;
        var method = dict.GetType().GetMethod("Remove", new[] { typeof(string) });
        method?.Invoke(dict, new object[] { key });
    }

    private static object GetDictItem(object dict, string key)
    {
        var indexer = dict?.GetType().GetProperty("Item", new[] { typeof(string) });
        return indexer?.GetValue(dict, new object[] { key });
    }

    private static object GetDictItemByKeyObj(object dict, object keyObj)
    {
        var indexer = dict.GetType().GetProperty("Item", new[] { keyObj.GetType() });
        return indexer?.GetValue(dict, new[] { keyObj });
    }

    private static void SetDictItem(object dict, string key, object value)
    {
        var indexer = dict.GetType().GetProperty("Item", new[] { typeof(string) });
        indexer?.SetValue(dict, value, new object[] { key });
    }

    private static object[] GetDictKeys(object dict)
    {
        if (GetProperty(dict, "Keys") is IEnumerable keys)
            return keys.Cast<object>().ToArray();
        return Array.Empty<object>();
    }

    private static object CreatePdfName(string name) =>
        PdfNameType != null
            ? Activator.CreateInstance(PdfNameType, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, new object[] { name }, null)
            : null;

    private static string StripExistingPrefix(string fontName) =>
        fontName.Length > 7 && fontName[6] == '+' ? fontName.Substring(7) : fontName;

    private static readonly Random Rng = new Random();
    private static string GenerateSubsetPrefix()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        lock (Rng)
        {
            return new string(Enumerable.Range(0, 6).Select(_ => chars[Rng.Next(chars.Length)]).ToArray()) + "+";
        }
    }
}