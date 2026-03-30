import { projectId } from '../../lib/supabase-info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// Türkçe → ASCII (jsPDF helvetica Türkçe karakter desteklemez)
export function tr(s: any): string {
  if (typeof s === 'number') return String(s);
  if (typeof s !== 'string') return String(s ?? '');
  return s
    .replace(/₺/g,'TL ').replace(/—/g,'-').replace(/–/g,'-')
    .replace(/ğ/g,'g').replace(/Ğ/g,'G')
    .replace(/ü/g,'u').replace(/Ü/g,'U')
    .replace(/ş/g,'s').replace(/Ş/g,'S')
    .replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ö/g,'o').replace(/Ö/g,'O')
    .replace(/ç/g,'c').replace(/Ç/g,'C');
}

export const trRow = (row: any[]): any[] => row.map((c: any) => typeof c === 'number' ? c : tr(String(c)));

export function formatTarih(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function tl(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}
