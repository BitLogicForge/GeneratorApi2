var sanitizedStreams = sourceStreams
    .Select(s => PdfFontPrefixFixer.MakeFontNamesUnique(s))
    .ToArray();

using var finalDoc = new PdfDocument();
finalDoc.FileStructure.IncrementalUpdate = false;

var mergeOptions = new PdfMergeOptions { OptimizeResources = true };
PdfDocumentBase.Merge(finalDoc, mergeOptions, sanitizedStreams);