import { getColombiaDateString, getColombiaNow } from '../../utils/formatting';

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-brand-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

export function getScoreBg(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 70) return 'bg-brand-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getScoreBadge(score: number): string {
  if (score >= 90) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (score >= 70) return 'bg-brand-100 text-brand-700';
  if (score >= 50) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 70) return 'Bueno';
  if (score >= 50) return 'Regular';
  return 'Bajo';
}

export function todayStr(): string {
  return getColombiaDateString();
}

export function weekAgoStr(): string {
  const d = getColombiaNow();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

export function daysAgoStr(days: number): string {
  const d = getColombiaNow();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}
