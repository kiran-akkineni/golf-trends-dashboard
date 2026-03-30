// lib/download.ts
// Converts chart data to CSV and triggers a browser download.

export interface DownloadDataset {
  label: string;
  values: (number | null)[];
}

export function downloadCsv(
  filename: string,
  labels: string[],
  datasets: DownloadDataset[]
): void {
  const header = ['Period', ...datasets.map((d) => d.label)].join(',');

  const rows = labels.map((label, i) => {
    const cells = datasets.map((d) => {
      const v = d.values[i];
      return v === null || v === undefined ? '' : String(v);
    });
    return [label, ...cells].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
