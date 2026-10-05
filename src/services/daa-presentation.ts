import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { AppError } from '../errors.js';

const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const chartNs = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const workbookPath = 'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx';
const invalidTemplate = () =>
  new AppError(
    500,
    'INVALID_TEMPLATE',
    'DAA template must contain its original 4x4 table and three-series, four-category line chart',
  );

/** Updates this template's native table, chart cache, and editable chart workbook. */
export class DaaPresentationService {
  constructor(
    private readonly path: string,
    private readonly nextNumber: () => number = () => randomInt(1, 101),
  ) {}

  async generate(): Promise<Buffer> {
    const zip = await JSZip.loadAsync(await readFile(this.path));
    const parse = async (archive: JSZip, path: string) => {
      const file = archive.file(path);
      if (!file) throw invalidTemplate();
      return new DOMParser().parseFromString(
        await file.async('string'),
        'application/xml',
      );
    };
    const serialize = new XMLSerializer();
    const slide = await parse(zip, 'ppt/slides/slide1.xml');
    const table = slide.getElementsByTagNameNS(drawing, 'tbl');
    if (table.length !== 1) throw invalidTemplate();
    const rows = Array.from(table[0].getElementsByTagNameNS(drawing, 'tr'));
    if (rows.length !== 4) throw invalidTemplate();
    const numbers = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => this.nextNumber()),
    );
    for (const [rowIndex, row] of rows.entries()) {
      const cells = Array.from(row.getElementsByTagNameNS(drawing, 'tc'));
      if (cells.length !== 4) throw invalidTemplate();
      for (const [columnIndex, cell] of cells.entries()) {
        let texts = Array.from(cell.getElementsByTagNameNS(drawing, 't'));
        if (!texts.length) {
          const paragraph = cell.getElementsByTagNameNS(drawing, 'p')[0];
          if (!paragraph) throw invalidTemplate();
          const run = slide.createElementNS(drawing, 'a:r');
          const endProperties = paragraph.getElementsByTagNameNS(
            drawing,
            'endParaRPr',
          )[0];
          if (endProperties) {
            const properties = slide.createElementNS(drawing, 'a:rPr');
            for (const attribute of Array.from(endProperties.attributes))
              properties.setAttributeNS(
                attribute.namespaceURI,
                attribute.name,
                attribute.value,
              );
            run.appendChild(properties);
          }
          const text = slide.createElementNS(drawing, 'a:t');
          run.appendChild(text);
          paragraph.insertBefore(run, endProperties ?? null);
          texts = [text];
        }
        texts[0].textContent = String(numbers[rowIndex][columnIndex]);
        for (const text of texts.slice(1)) text.textContent = '';
      }
    }

    const chart = await parse(zip, 'ppt/charts/chart1.xml');
    const lineChart = chart.getElementsByTagNameNS(chartNs, 'lineChart')[0];
    if (!lineChart) throw invalidTemplate();
    const series = Array.from(lineChart.getElementsByTagNameNS(chartNs, 'ser'));
    if (series.length !== 3) throw invalidTemplate();
    const embedded = zip.file(workbookPath);
    if (!embedded) throw invalidTemplate();
    const workbook = await JSZip.loadAsync(await embedded.async('nodebuffer'));
    const sheet = await parse(workbook, 'xl/worksheets/sheet1.xml');
    const sheetCells = new Map(
      Array.from(sheet.getElementsByTagNameNS(spreadsheet, 'c')).map((cell) => [
        cell.getAttribute('r'),
        cell,
      ]),
    );
    for (const [seriesIndex, item] of series.entries()) {
      const column = String.fromCharCode(66 + seriesIndex);
      const values = item.getElementsByTagNameNS(chartNs, 'val')[0];
      const formula = values?.getElementsByTagNameNS(chartNs, 'f')[0];
      const cache = values?.getElementsByTagNameNS(chartNs, 'numCache')[0];
      if (!cache || formula?.textContent !== `Sheet1!$${column}$2:$${column}$5`)
        throw invalidTemplate();
      const points = Array.from(cache.getElementsByTagNameNS(chartNs, 'pt'));
      if (points.length !== 4) throw invalidTemplate();
      for (const point of points) {
        const index = Number(point.getAttribute('idx'));
        const value = point.getElementsByTagNameNS(chartNs, 'v')[0];
        const cell = sheetCells.get(`${column}${index + 2}`);
        const cellValue = cell?.getElementsByTagNameNS(spreadsheet, 'v')[0];
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index > 3 ||
          !value ||
          !cell ||
          !cellValue
        )
          throw invalidTemplate();
        value.textContent = String(numbers[index][seriesIndex + 1]);
        cell.removeAttribute('t');
        cellValue.textContent = value.textContent;
      }
    }
    zip.file('ppt/slides/slide1.xml', serialize.serializeToString(slide), {
      createFolders: false,
    });
    zip.file('ppt/charts/chart1.xml', serialize.serializeToString(chart), {
      createFolders: false,
    });
    workbook.file(
      'xl/worksheets/sheet1.xml',
      serialize.serializeToString(sheet),
      { createFolders: false },
    );
    zip.file(
      workbookPath,
      await workbook.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      }),
      { createFolders: false },
    );
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
