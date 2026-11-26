import { safeFileName } from '../../utils/safeFileName';
import { saveBlob } from '../../utils/saveBlob';

/** Saves a table the tab already shows as a CSV file. */
export function CsvExportButton({ name, csv }: { name: string; csv: () => string }) {
  const exportCsv = () =>
    saveBlob(`pidtuna-${safeFileName(name, 'results')}.csv`, new Blob([csv()], { type: 'text/csv' }), {
      name: 'CSV table',
      extension: 'csv',
    });

  return (
    <button type="button" className="btn btn--sm" data-tip="Save these results as a CSV table" onClick={exportCsv}>
      Export CSV
    </button>
  );
}
