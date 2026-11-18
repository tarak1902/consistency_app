import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { fetchExport } from '@/data/queries';
import { APP_NAME } from './config';

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

async function share(name: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Everything the user owns as one JSON document, via the share sheet. */
export async function exportJson(): Promise<void> {
  const data = await fetchExport();
  const doc = {
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    plans: data.plans.map((p) => ({
      ...p,
      works: data.works.filter((w) => w.plan_id === p.id),
      checkins: data.checkins.filter((c) => c.plan_id === p.id),
    })),
  };
  await share(
    `${APP_NAME.toLowerCase()}-export-${stamp()}.json`,
    JSON.stringify(doc, null, 2),
    'application/json',
  );
}

/** One row per check-in, with its plan and work, via the share sheet. */
export async function exportCsv(): Promise<void> {
  const data = await fetchExport();
  const plans = new Map(data.plans.map((p) => [p.id, p]));
  const works = new Map(data.works.map((w) => [w.id, w]));
  const rows: (string | number | null)[][] = [
    [
      'plan_id',
      'plan_status',
      'plan_start',
      'plan_end',
      'rate',
      'work_position',
      'work_title',
      'plan_day',
      'ticked_at',
    ],
  ];
  for (const c of data.checkins) {
    const p = plans.get(c.plan_id);
    const w = works.get(c.work_id);
    rows.push([
      c.plan_id,
      p?.status ?? null,
      p?.start_date ?? null,
      p?.end_date ?? null,
      p ? Number(p.rate) : null,
      w ? w.position + 1 : null,
      w?.title ?? null,
      c.plan_day,
      c.created_at,
    ]);
  }
  await share(`${APP_NAME.toLowerCase()}-checkins-${stamp()}.csv`, toCsv(rows), 'text/csv');
}
