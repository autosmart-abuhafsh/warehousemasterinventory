/**
 * Export utilities for Excel (.xls SpreadsheetML & .csv), CSV import parsing,
 * and deterministic Barcode / QR Code SVG matrix generation.
 */

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T, index: number) => string | number;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates and downloads an Excel-compatible .xls file (SpreadsheetML XML)
 * with full detail rows, company header, and summary metadata.
 */
export function downloadExcelReport<T>(
  filename: string,
  reportTitle: string,
  subtitle: string,
  columns: ExportColumn<T>[],
  data: T[]
): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14" ss:Color="#0B1220"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:Italic="1" ss:Size="10" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#111C30" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Cell">
   <Font ss:Size="10"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Laporan Gudang">
  <Table>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml('PT. GLOBAL ENERGI LESTARI – WAREHOUSE JATIREJO')}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(reportTitle)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="Subtitle"><Data ss:Type="String">${escapeXml(`${subtitle} | Dicetak: ${timestamp}`)}</Data></Cell>
   </Row>
   <Row></Row>
   <Row>
    ${columns
      .map(
        (col) =>
          `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`
      )
      .join('')}
   </Row>`;

  data.forEach((row, idx) => {
    xml += `\n   <Row>`;
    columns.forEach((col) => {
      const val = col.accessor(row, idx);
      const isNum = typeof val === 'number' && Number.isFinite(val);
      xml += `<Cell ss:StyleID="Cell"><Data ss:Type="${
        isNum ? 'Number' : 'String'
      }">${escapeXml(String(val ?? ''))}</Data></Cell>`;
    });
    xml += `</Row>`;
  });

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a UTF-8 BOM CSV file.
 */
export function downloadCsvReport<T>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[]
): void {
  const escapeCsvCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const bodyLines = data.map((row, idx) =>
    columns.map((c) => escapeCsvCell(c.accessor(row, idx))).join(',')
  );

  const csvContent = '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Deterministic 1D Barcode (Code-128 style visual bar widths) from partNumber string
 */
export function generateBarcodeBars(code: string): number[] {
  const normalized = (code || 'GEL-000').toUpperCase();
  const bars: number[] = [2, 1, 1, 2, 3, 1]; // Start pattern
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    bars.push(((charCode >> 0) & 3) + 1);
    bars.push(((charCode >> 2) & 2) + 1);
    bars.push(((charCode >> 4) & 3) + 1);
    bars.push(((charCode >> 1) & 2) + 1);
  }
  bars.push(2, 3, 1, 1, 2); // Stop pattern
  return bars;
}

/**
 * Deterministic 21x21 QR Code Matrix generator from string payload
 */
export function generateQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rowOffset + r][colOffset + c] = isBorder || isCenter;
        reserved[rowOffset + r][colOffset + c] = true;
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let seed = Math.abs(hash) || 1234567;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        if (r <= 7 && (c <= 7 || c >= size - 8)) continue;
        if (r >= size - 8 && c <= 7) continue;
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        const charFactor =
          payload.charCodeAt((r * size + c) % payload.length) || 65;
        matrix[r][c] = ((seed ^ charFactor) & 1) === 1;
      }
    }
  }

  return matrix;
}
