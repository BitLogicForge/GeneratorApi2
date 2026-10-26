using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Interactive;
using Syncfusion.Pdf.Parsing;

/// <summary>
/// Backwards-compatible entry point; delegates to <see cref="PdfAMerger"/>.
/// </summary>
public static class PdfOption5Merger
{
    /// <summary>
    /// Option 5: Merges multiple PDFs with OptimizeResources = true,
    /// sanitizes font subsets via reflection, and outputs a compliant PDF/A-2b file.
    /// </summary>
    /// <param name="sourcePdfStreams">Array of input PDF streams to merge.</param>
    /// <param name="fallbackTtfBytes">Raw byte array of a fallback TTF font (e.g., Arial.ttf) for PDF/A compliance.</param>
    /// <returns>A MemoryStream containing the final PDF/A-2b document.</returns>
    public static MemoryStream MergeAndConvertToPdfA_Option5(Stream[] sourcePdfStreams, byte[] fallbackTtfBytes) =>
        new PdfAMerger(fallbackTtfBytes).Merge(sourcePdfStreams);
}

/// <summary>
/// Sanitizes each source, merges them with resource optimization, and converts the result to PDF/A-2b.
/// </summary>
public sealed class PdfAMerger
{
    private readonly PdfAConverter _converter;
    private readonly SourcePdfSanitizer _sanitizer = new SourcePdfSanitizer();

    public PdfAMerger(byte[] fallbackTtfBytes)
    {
        _converter = new PdfAConverter(fallbackTtfBytes);
    }

    public MemoryStream Merge(IReadOnlyList<Stream> sourcePdfStreams)
    {
        if (sourcePdfStreams == null || sourcePdfStreams.Count == 0)
            throw new ArgumentException("At least one source PDF stream is required.", nameof(sourcePdfStreams));

        var sanitizedStreams = new List<MemoryStream>();

        try
        {
            // 1. Sanitize and give unique prefixes to every embedded font in each source PDF
            foreach (var stream in sourcePdfStreams)
            {
                stream.Position = 0;
                sanitizedStreams.Add(_sanitizer.Sanitize(stream));
            }

            // 2. Merge using OptimizeResources = true (deduplicates images/logos safely without font collisions)
            using (var tempMergedStream = MergeStreams(sanitizedStreams))
            {
                // 3. Reload into PdfLoadedDocument and convert to PDF/A-2b
                try
                {
                    return _converter.Convert(tempMergedStream);
                }
                catch (NullReferenceException ex) when (ColorSpaceFailureDiagnoser.IsColorSpaceParserFailure(ex))
                {
                    // The DeviceN/Separation parser hit a colour space it could not resolve.
                    // Find out which source(s) trigger it so the failure is actionable.
                    var diagnosis = new ColorSpaceFailureDiagnoser(_converter).Describe(sanitizedStreams);
                    throw new InvalidOperationException(diagnosis, ex);
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

    private static MemoryStream MergeStreams(IEnumerable<MemoryStream> sources)
    {
        using (var mergedDoc = new PdfDocument())
        {
            mergedDoc.FileStructure.IncrementalUpdate = false;

            var mergeOptions = new PdfMergeOptions
            {
                OptimizeResources = true
            };

            PdfDocumentBase.Merge(mergedDoc, mergeOptions, sources.Cast<Stream>().ToArray());
            return mergedDoc.SaveToMemory();
        }
    }
}

/// <summary>
/// Converts a PDF to PDF/A-2b, substituting non-embedded fonts with a fallback TTF.
/// </summary>
internal sealed class PdfAConverter
{
    private readonly byte[] _fallbackTtfBytes;

    public PdfAConverter(byte[] fallbackTtfBytes)
    {
        if (fallbackTtfBytes == null || fallbackTtfBytes.Length == 0)
            throw new ArgumentException("Fallback TTF bytes are required for PDF/A font substitution.", nameof(fallbackTtfBytes));

        _fallbackTtfBytes = fallbackTtfBytes;
    }

    public MemoryStream Convert(Stream source)
    {
        using (var loaded = new PdfLoadedDocument(source))
        {
            // Always hand out a fresh stream instance per invocation
            loaded.SubstituteFont += (sender, args) =>
            {
                args.FontStream = new MemoryStream(_fallbackTtfBytes, writable: false);
            };

            // Use PDF/A-2b (supports transparency and modern vector graphics)
            loaded.Conformance = PdfConformanceLevel.Pdf_A2B;

            return loaded.SaveToMemory();
        }
    }
}

/// <summary>
/// Pinpoints whether a DeviceN/Separation parser failure comes from a specific source or from the merge itself.
/// </summary>
internal sealed class ColorSpaceFailureDiagnoser
{
    private readonly PdfAConverter _converter;

    public ColorSpaceFailureDiagnoser(PdfAConverter converter)
    {
        _converter = converter;
    }

    public static bool IsColorSpaceParserFailure(Exception ex) =>
        ex.StackTrace != null &&
        (ex.StackTrace.Contains("DeviceN") || ex.StackTrace.Contains("Separation"));

    public string Describe(IReadOnlyList<MemoryStream> sanitizedStreams)
    {
        var failing = Enumerable.Range(0, sanitizedStreams.Count)
            .Where(i => FailsOnItsOwn(sanitizedStreams[i]))
            .ToList();

        return failing.Count > 0
            ? $"PDF/A conversion failed in the DeviceN/Separation colour parser. Source PDF index(es) {string.Join(", ", failing)} fail on their own, so the colour space in those inputs is unsupported or malformed."
            : "PDF/A conversion failed in the DeviceN/Separation colour parser only after merging. Every source converts on its own, so the merge's resource deduplication broke a shared colour space.";
    }

    private bool FailsOnItsOwn(MemoryStream source)
    {
        try
        {
            using (var copy = new MemoryStream(source.ToArray()))
            using (_converter.Convert(copy)) { }
            return false;
        }
        catch (NullReferenceException ex) when (IsColorSpaceParserFailure(ex))
        {
            return true;
        }
    }
}

/// <summary>
/// Flattens interactive content, drops the AcroForm and gives every embedded font a unique subset prefix.
/// </summary>
internal sealed class SourcePdfSanitizer
{
    public MemoryStream Sanitize(Stream inputPdfStream)
    {
        // Pass 1: flatten forms and annotations. Flatten is applied during Save, so it must
        // finish before /AcroForm is removed, otherwise flattened fields lose their /DR resources.
        using (var flattened = FlattenInteractiveContent(inputPdfStream))
        using (var loadedDoc = new PdfLoadedDocument(flattened))
        {
            // Pass 2: drop the (now empty) AcroForm and prefix embedded fonts
            loadedDoc.FileStructure.IncrementalUpdate = false;

            PdfDict.FromProperty(loadedDoc, "Catalog")?.Remove("AcroForm");

            var prefixer = new EmbeddedFontPrefixer(FontSubsetTag.Generate());
            for (int i = 0; i < loadedDoc.Pages.Count; i++)
            {
                prefixer.ProcessPage(PdfDict.FromProperty(loadedDoc.Pages[i], "Dictionary"));
            }

            return loadedDoc.SaveToMemory();
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

            return loadedDoc.SaveToMemory();
        }
    }
}

/// <summary>
/// Walks a document's resource tree and rewrites the subset prefix of every embedded font.
/// One instance per document, so shared fonts and resources are only touched once.
/// </summary>
internal sealed class EmbeddedFontPrefixer
{
    private static readonly string[] EmbeddedFontFileKeys = { "FontFile", "FontFile2", "FontFile3" };

    private readonly string _prefix;
    private readonly HashSet<PdfDict> _visited = new HashSet<PdfDict>();

    public EmbeddedFontPrefixer(string prefix)
    {
        _prefix = prefix;
    }

    public void ProcessPage(PdfDict page) => ProcessResources(GetInheritedResources(page));

    // /Resources may be inherited from an ancestor /Pages node.
    private static PdfDict GetInheritedResources(PdfDict page)
    {
        var node = page;
        for (int depth = 0; node != null && depth < 64; depth++)
        {
            if (node.ContainsKey("Resources"))
                return node.GetDict("Resources");

            node = node.GetDict("Parent");
        }
        return null;
    }

    private void ProcessResources(PdfDict resources)
    {
        if (resources == null || !_visited.Add(resources)) return;

        foreach (var font in resources.GetDictEntries("Font"))
        {
            PrefixFont(font);

            // Type3 glyph procedures carry their own resources
            ProcessResources(font.GetDict("Resources"));
        }

        // Form XObjects and tiling patterns can hold nested resources
        foreach (var entry in resources.GetDictEntries("XObject").Concat(resources.GetDictEntries("Pattern")))
        {
            ProcessResources(entry.GetDict("Resources"));
        }
    }

    private void PrefixFont(PdfDict font)
    {
        // Fonts shared between pages must only be prefixed once
        if (!_visited.Add(font)) return;

        // Non-embedded fonts (e.g. standard 14 Helvetica) must keep their real name,
        // otherwise Syncfusion no longer recognises them during PDF/A substitution.
        if (!IsEmbedded(font)) return;

        RenameWithPrefix(font, "BaseFont");
        var descriptor = font.GetDict("FontDescriptor");
        if (descriptor != null)
        {
            RenameWithPrefix(descriptor, "FontName");
        }

        foreach (var cidFont in font.GetDictArray("DescendantFonts"))
        {
            PrefixFont(cidFont);
        }
    }

    private static bool IsEmbedded(PdfDict font)
    {
        var descriptor = font.GetDict("FontDescriptor");
        if (descriptor != null && EmbeddedFontFileKeys.Any(descriptor.ContainsKey))
            return true;

        // Type0 fonts keep the descriptor on the descendant CIDFont
        return font.GetDictArray("DescendantFonts").Any(IsEmbedded);
    }

    private void RenameWithPrefix(PdfDict dict, string key)
    {
        string currentVal = dict.GetName(key);
        if (string.IsNullOrEmpty(currentVal)) return;

        dict.SetName(key, _prefix + FontSubsetTag.Strip(currentVal));
    }
}

/// <summary>
/// The six-uppercase-letter "ABCDEF+" tag that marks a font subset.
/// </summary>
internal static class FontSubsetTag
{
    private const string Letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static readonly Random Rng = new Random();

    public static string Generate()
    {
        lock (Rng)
        {
            return new string(Enumerable.Range(0, 6).Select(_ => Letters[Rng.Next(Letters.Length)]).ToArray()) + "+";
        }
    }

    public static string Strip(string fontName) =>
        fontName.Length > 7 && fontName[6] == '+' && fontName.Take(6).All(c => c >= 'A' && c <= 'Z')
            ? fontName.Substring(7)
            : fontName;
}

/// <summary>
/// Typed wrapper over Syncfusion's internal PdfDictionary. Equality is by identity of the
/// underlying dictionary, so wrappers can be used to track visited nodes.
/// </summary>
internal sealed class PdfDict : IEquatable<PdfDict>
{
    private readonly object _raw;

    private PdfDict(object raw)
    {
        _raw = raw;
    }

    /// <summary>Dereferences a primitive and wraps it, or returns null if it is not a dictionary.</summary>
    public static PdfDict Wrap(object primitive)
    {
        var resolved = SyncfusionInternals.Dereference(primitive);
        return SyncfusionInternals.PdfDictionaryType.IsInstanceOfType(resolved) ? new PdfDict(resolved) : null;
    }

    public static PdfDict FromProperty(object owner, string propertyName) =>
        Wrap(SyncfusionInternals.GetProperty(owner, propertyName));

    public bool ContainsKey(string key)
    {
        var method = _raw.GetType().GetMethod("ContainsKey", new[] { typeof(string) });
        return (bool)(method?.Invoke(_raw, new object[] { key }) ?? false);
    }

    public void Remove(string key)
    {
        if (!ContainsKey(key)) return;
        var method = _raw.GetType().GetMethod("Remove", new[] { typeof(string) });
        method?.Invoke(_raw, new object[] { key });
    }

    public PdfDict GetDict(string key) => ContainsKey(key) ? Wrap(GetRaw(key)) : null;

    /// <summary>All dictionary values of the sub-dictionary at <paramref name="key"/>, e.g. every font in /Font.</summary>
    public IEnumerable<PdfDict> GetDictEntries(string key)
    {
        var dict = GetDict(key);
        return dict == null ? Enumerable.Empty<PdfDict>() : dict.DictValues();
    }

    /// <summary>All dictionary items of the array at <paramref name="key"/>, e.g. /DescendantFonts.</summary>
    public IEnumerable<PdfDict> GetDictArray(string key)
    {
        if (!ContainsKey(key)) yield break;

        var array = SyncfusionInternals.Dereference(GetRaw(key));
        if (!SyncfusionInternals.PdfArrayType.IsInstanceOfType(array) || !(array is IEnumerable items)) yield break;

        foreach (var item in items)
        {
            var dict = Wrap(item);
            if (dict != null)
                yield return dict;
        }
    }

    public string GetName(string key)
    {
        if (!ContainsKey(key)) return null;

        var name = SyncfusionInternals.Dereference(GetRaw(key));
        return SyncfusionInternals.PdfNameType.IsInstanceOfType(name)
            ? SyncfusionInternals.GetProperty(name, "Value") as string
            : null;
    }

    public void SetName(string key, string value)
    {
        var indexer = _raw.GetType().GetProperty("Item", new[] { typeof(string) });
        indexer?.SetValue(_raw, SyncfusionInternals.CreatePdfName(value), new object[] { key });
    }

    private IEnumerable<PdfDict> DictValues()
    {
        if (!(SyncfusionInternals.GetProperty(_raw, "Keys") is IEnumerable keys)) yield break;

        // Snapshot the keys so callers may mutate entries while iterating
        foreach (var keyObj in keys.Cast<object>().ToArray())
        {
            var indexer = _raw.GetType().GetProperty("Item", new[] { keyObj.GetType() });
            var dict = Wrap(indexer?.GetValue(_raw, new[] { keyObj }));
            if (dict != null)
                yield return dict;
        }
    }

    private object GetRaw(string key)
    {
        var indexer = _raw.GetType().GetProperty("Item", new[] { typeof(string) });
        return indexer?.GetValue(_raw, new object[] { key });
    }

    public bool Equals(PdfDict other) => other != null && ReferenceEquals(_raw, other._raw);
    public override bool Equals(object obj) => Equals(obj as PdfDict);
    public override int GetHashCode() => ReferenceEqualityComparer.Instance.GetHashCode(_raw);
}

/// <summary>
/// Reflection access to Syncfusion internals. Resolved once and fails fast if the Syncfusion version changes.
/// </summary>
internal static class SyncfusionInternals
{
    private static readonly Assembly SyncfusionAssembly = typeof(PdfLoadedDocument).Assembly;
    private static readonly Type PdfCrossTableType = RequireType("Syncfusion.Pdf.Parsing.PdfCrossTable");
    public static readonly Type PdfDictionaryType = RequireType("Syncfusion.Pdf.Primitives.PdfDictionary");
    public static readonly Type PdfNameType = RequireType("Syncfusion.Pdf.Primitives.PdfName");
    public static readonly Type PdfArrayType = RequireType("Syncfusion.Pdf.Primitives.PdfArray");
    private static readonly MethodInfo DereferenceMethod =
        PdfCrossTableType.GetMethod("Dereference", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("Syncfusion internal PdfCrossTable.Dereference not found; font sanitizing would silently do nothing.");

    public static object Dereference(object primitive) =>
        primitive == null ? null : DereferenceMethod.Invoke(null, new[] { primitive });

    public static object GetProperty(object target, string propName) =>
        target?.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(target);

    public static object CreatePdfName(string name) =>
        Activator.CreateInstance(PdfNameType, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, new object[] { name }, null);

    private static Type RequireType(string fullName) =>
        SyncfusionAssembly.GetType(fullName)
        ?? throw new InvalidOperationException($"Syncfusion internal type '{fullName}' not found; this Syncfusion version is not supported by PdfOption5Merger.");
}

internal static class PdfDocumentExtensions
{
    public static MemoryStream SaveToMemory(this PdfDocumentBase document)
    {
        var output = new MemoryStream();
        document.Save(output);
        output.Position = 0;
        return output;
    }
}
