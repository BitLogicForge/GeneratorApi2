using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Interactive;
using Syncfusion.Pdf.Parsing;

public static class PdfOption5Merger
{
    private static readonly Assembly SyncfusionAssembly = typeof(PdfLoadedDocument).Assembly;
    private static readonly Type PdfCrossTableType = RequireType("Syncfusion.Pdf.Parsing.PdfCrossTable");
    private static readonly Type PdfDictionaryType = RequireType("Syncfusion.Pdf.Primitives.PdfDictionary");
    private static readonly Type PdfNameType = RequireType("Syncfusion.Pdf.Primitives.PdfName");
    private static readonly Type PdfArrayType = RequireType("Syncfusion.Pdf.Primitives.PdfArray");
    private static readonly MethodInfo DereferenceMethod =
        PdfCrossTableType.GetMethod("Dereference", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("Syncfusion internal PdfCrossTable.Dereference not found; font sanitizing would silently do nothing.");

    private static readonly string[] EmbeddedFontFileKeys = { "FontFile", "FontFile2", "FontFile3" };

    /// <summary>
    /// Option 5: Merges multiple PDFs with OptimizeResources = true,
    /// sanitizes font subsets via reflection, and outputs a compliant PDF/A-2b file.
    /// </summary>
    /// <param name="sourcePdfStreams">Array of input PDF streams to merge.</param>
    /// <param name="fallbackTtfBytes">Raw byte array of a fallback TTF font (e.g., Arial.ttf) for PDF/A compliance.</param>
    /// <returns>A MemoryStream containing the final PDF/A-2b document.</returns>
    public static MemoryStream MergeAndConvertToPdfA_Option5(Stream[] sourcePdfStreams, byte[] fallbackTtfBytes)
    {
        if (sourcePdfStreams == null || sourcePdfStreams.Length == 0)
            throw new ArgumentException("At least one source PDF stream is required.", nameof(sourcePdfStreams));
        if (fallbackTtfBytes == null || fallbackTtfBytes.Length == 0)
            throw new ArgumentException("Fallback TTF bytes are required for PDF/A font substitution.", nameof(fallbackTtfBytes));

        var sanitizedStreams = new List<MemoryStream>();

        try
        {
            // 1. Sanitize and give unique prefixes to every embedded font in each source PDF
            foreach (var stream in sourcePdfStreams)
            {
                stream.Position = 0;
                sanitizedStreams.Add(SanitizeAndFixFonts(stream));
            }

            // 2. Merge using OptimizeResources = true (deduplicates images/logos safely without font collisions)
            using (var mergedDoc = new PdfDocument())
            {
                mergedDoc.FileStructure.IncrementalUpdate = false;

                var mergeOptions = new PdfMergeOptions
                {
                    OptimizeResources = true
                };

                PdfDocumentBase.Merge(mergedDoc, mergeOptions, sanitizedStreams.Select(s => (Stream)s).ToArray());

                using (var tempMergedStream = new MemoryStream())
                {
                    mergedDoc.Save(tempMergedStream);
                    tempMergedStream.Position = 0;

                    // 3. Reload into PdfLoadedDocument and convert to PDF/A-2b
                    try
                    {
                        return ConvertToPdfA(tempMergedStream, fallbackTtfBytes);
                    }
                    catch (NullReferenceException ex) when (IsColorSpaceParserFailure(ex))
                    {
                        // The DeviceN/Separation parser hit a colour space it could not resolve.
                        // Find out which source(s) trigger it so the failure is actionable.
                        throw new InvalidOperationException(DescribeColorSpaceFailure(sanitizedStreams, fallbackTtfBytes), ex);
                    }
                }
            }
        }
        finally
        {
            // Clean up intermediate sanitized streams
            foreach (var s in sanitizedStreams)
            {
                s.Dispose();
            }
        }
    }

    private static MemoryStream ConvertToPdfA(Stream source, byte[] fallbackTtfBytes)
    {
        using (var loaded = new PdfLoadedDocument(source))
        {
            // Always hand out a fresh stream instance per invocation
            loaded.SubstituteFont += (sender, args) =>
            {
                args.FontStream = new MemoryStream(fallbackTtfBytes, writable: false);
            };

            // Use PDF/A-2b (supports transparency and modern vector graphics)
            loaded.Conformance = PdfConformanceLevel.Pdf_A2B;

            var output = new MemoryStream();
            loaded.Save(output);
            output.Position = 0;
            return output;
        }
    }

    private static bool IsColorSpaceParserFailure(Exception ex) =>
        ex.StackTrace != null &&
        (ex.StackTrace.Contains("DeviceN") || ex.StackTrace.Contains("Separation"));

    private static string DescribeColorSpaceFailure(List<MemoryStream> sanitizedStreams, byte[] fallbackTtfBytes)
    {
        var failing = new List<int>();
        for (int i = 0; i < sanitizedStreams.Count; i++)
        {
            try
            {
                using (var copy = new MemoryStream(sanitizedStreams[i].ToArray()))
                using (ConvertToPdfA(copy, fallbackTtfBytes)) { }
            }
            catch (NullReferenceException ex) when (IsColorSpaceParserFailure(ex))
            {
                failing.Add(i);
            }
        }

        return failing.Count > 0
            ? $"PDF/A conversion failed in the DeviceN/Separation colour parser. Source PDF index(es) {string.Join(", ", failing)} fail on their own, so the colour space in those inputs is unsupported or malformed."
            : "PDF/A conversion failed in the DeviceN/Separation colour parser only after merging. Every source converts on its own, so the merge's resource deduplication broke a shared colour space.";
    }

    private static MemoryStream SanitizeAndFixFonts(Stream inputPdfStream)
    {
        // Pass 1: flatten forms and annotations. Flatten is applied during Save, so it must
        // finish before /AcroForm is removed, otherwise flattened fields lose their /DR resources.
        using (var flattened = FlattenInteractiveContent(inputPdfStream))
        using (var loadedDoc = new PdfLoadedDocument(flattened))
        {
            // Pass 2: drop the (now empty) AcroForm and prefix embedded fonts
            loadedDoc.FileStructure.IncrementalUpdate = false;

            var catalog = GetProperty(loadedDoc, "Catalog");
            if (DictContainsKey(catalog, "AcroForm"))
            {
                RemoveDictKey(catalog, "AcroForm");
            }

            string uniqueTag = GenerateSubsetPrefix();
            var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);

            for (int i = 0; i < loadedDoc.Pages.Count; i++)
            {
                var pageDict = GetProperty(loadedDoc.Pages[i], "Dictionary");
                ProcessResources(GetInheritedResources(pageDict), uniqueTag, visited);
            }

            var output = new MemoryStream();
            loadedDoc.Save(output);
            output.Position = 0;
            return output;
        }
    }

    private static MemoryStream FlattenInteractiveContent(Stream inputPdfStream)
    {
        using (var loadedDoc = new PdfLoadedDocument(inputPdfStream))
        {
            loadedDoc.FileStructure.IncrementalUpdate = false;

            if (loadedDoc.Form != null)
            {
                loadedDoc.Form.Flatten = true;
            }

            for (int i = 0; i < loadedDoc.Pages.Count; i++)
            {
                if (loadedDoc.Pages[i] is PdfLoadedPage loadedPage && loadedPage.Annotations != null)
                {
                    loadedPage.Annotations.Flatten = true;
                }
            }

            var output = new MemoryStream();
            loadedDoc.Save(output);
            output.Position = 0;
            return output;
        }
    }

    // /Resources may be inherited from an ancestor /Pages node.
    private static object GetInheritedResources(object pageDict)
    {
        var node = pageDict;
        for (int depth = 0; node != null && depth < 64; depth++)
        {
            if (DictContainsKey(node, "Resources"))
                return Dereference(GetDictItem(node, "Resources"));

            node = DictContainsKey(node, "Parent") ? Dereference(GetDictItem(node, "Parent")) : null;
        }
        return null;
    }

    private static void ProcessResources(object resources, string prefix, HashSet<object> visited)
    {
        if (!IsType(resources, PdfDictionaryType) || !visited.Add(resources)) return;

        foreach (var font in GetResourceEntries(resources, "Font"))
        {
            PrefixFontDictionary(font, prefix, visited);

            // Type3 glyph procedures carry their own resources
            if (DictContainsKey(font, "Resources"))
                ProcessResources(Dereference(GetDictItem(font, "Resources")), prefix, visited);
        }

        // Form XObjects and tiling patterns can hold nested resources
        foreach (var entry in GetResourceEntries(resources, "XObject").Concat(GetResourceEntries(resources, "Pattern")))
        {
            if (DictContainsKey(entry, "Resources"))
                ProcessResources(Dereference(GetDictItem(entry, "Resources")), prefix, visited);
        }
    }

    private static IEnumerable<object> GetResourceEntries(object resources, string category)
    {
        if (!DictContainsKey(resources, category)) yield break;

        var dict = Dereference(GetDictItem(resources, category));
        if (!IsType(dict, PdfDictionaryType)) yield break;

        foreach (var key in GetDictKeys(dict))
        {
            var entry = Dereference(GetDictItemByKeyObj(dict, key));
            if (IsType(entry, PdfDictionaryType))
                yield return entry;
        }
    }

    private static void PrefixFontDictionary(object font, string prefix, HashSet<object> visited)
    {
        // Fonts shared between pages must only be prefixed once
        if (!visited.Add(font)) return;

        // Non-embedded fonts (e.g. standard 14 Helvetica) must keep their real name,
        // otherwise Syncfusion no longer recognises them during PDF/A substitution.
        if (!IsEmbeddedFont(font)) return;

        RenameNameEntry(font, "BaseFont", prefix);

        if (DictContainsKey(font, "FontDescriptor"))
        {
            var descriptor = Dereference(GetDictItem(font, "FontDescriptor"));
            if (IsType(descriptor, PdfDictionaryType))
            {
                RenameNameEntry(descriptor, "FontName", prefix);
            }
        }

        foreach (var cidFont in GetDescendantFonts(font))
        {
            PrefixFontDictionary(cidFont, prefix, visited);
        }
    }

    private static bool IsEmbeddedFont(object font)
    {
        if (DictContainsKey(font, "FontDescriptor"))
        {
            var descriptor = Dereference(GetDictItem(font, "FontDescriptor"));
            if (IsType(descriptor, PdfDictionaryType) && EmbeddedFontFileKeys.Any(k => DictContainsKey(descriptor, k)))
                return true;
        }

        // Type0 fonts keep the descriptor on the descendant CIDFont
        return GetDescendantFonts(font).Any(IsEmbeddedFont);
    }

    private static IEnumerable<object> GetDescendantFonts(object font)
    {
        if (!DictContainsKey(font, "DescendantFonts")) yield break;

        var descendants = Dereference(GetDictItem(font, "DescendantFonts"));
        if (!IsType(descendants, PdfArrayType) || !(descendants is IEnumerable enumerable)) yield break;

        foreach (var item in enumerable)
        {
            var cidFont = Dereference(item);
            if (IsType(cidFont, PdfDictionaryType))
                yield return cidFont;
        }
    }

    private static void RenameNameEntry(object dict, string key, string prefix)
    {
        if (!DictContainsKey(dict, key)) return;

        var name = Dereference(GetDictItem(dict, key));
        if (!IsType(name, PdfNameType)) return;

        string currentVal = GetProperty(name, "Value") as string;
        if (string.IsNullOrEmpty(currentVal)) return;

        var newName = CreatePdfName(prefix + StripExistingPrefix(currentVal));
        if (newName != null)
        {
            SetDictItem(dict, key, newName);
        }
    }

    // --- Reflection & Primitive Helpers ---

    private static Type RequireType(string fullName) =>
        SyncfusionAssembly.GetType(fullName)
        ?? throw new InvalidOperationException($"Syncfusion internal type '{fullName}' not found; this Syncfusion version is not supported by PdfOption5Merger.");

    private static object Dereference(object primitive) =>
        primitive == null ? null : DereferenceMethod.Invoke(null, new[] { primitive });

    private static bool IsType(object obj, Type targetType) =>
        obj != null && targetType.IsInstanceOfType(obj);

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
        if (dict == null || keyObj == null) return null;
        var indexer = dict.GetType().GetProperty("Item", new[] { keyObj.GetType() });
        return indexer?.GetValue(dict, new object[] { keyObj });
    }

    private static void SetDictItem(object dict, string key, object value)
    {
        var indexer = dict?.GetType().GetProperty("Item", new[] { typeof(string) });
        indexer?.SetValue(dict, value, new object[] { key });
    }

    private static object[] GetDictKeys(object dict)
    {
        if (GetProperty(dict, "Keys") is IEnumerable keys)
            return keys.Cast<object>().ToArray();
        return Array.Empty<object>();
    }

    private static object CreatePdfName(string name) =>
        Activator.CreateInstance(PdfNameType, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, new object[] { name }, null);

    private static string StripExistingPrefix(string fontName) =>
        fontName.Length > 7 && fontName[6] == '+' && fontName.Take(6).All(c => c >= 'A' && c <= 'Z')
            ? fontName.Substring(7)
            : fontName;

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
