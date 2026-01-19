// CSV Export Utility

export interface CsvColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | null);
}

export function exportToCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  // Build header row
  const headers = columns.map(col => `"${col.header}"`).join(',');

  // Build data rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value: string | number | null;
      
      if (typeof col.accessor === 'function') {
        value = col.accessor(row);
      } else {
        value = row[col.accessor] as string | number | null;
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '""';
      }

      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });

  // Combine header and rows
  const csvContent = [headers, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
