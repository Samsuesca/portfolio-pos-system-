import { open } from '@tauri-apps/plugin-shell';

export const FEEDBACK_REPO_URL = 'https://github.com/Samsuesca/uniformes-feedback';

export type FeedbackTemplate = 'bug_report' | 'feature_request' | 'ux_feedback';

interface BuildFeedbackUrlArgs {
  template: FeedbackTemplate;
  section?: string;
  platform?: string;
  appVersion?: string;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function buildFeedbackUrl({ template, section, platform, appVersion }: BuildFeedbackUrlArgs): string {
  const params = new URLSearchParams({ template: `${template}.yml` });
  if (section) params.set('section', section);
  if (platform) params.set('platform', platform);
  if (appVersion) params.set('app_version', appVersion);
  return `${FEEDBACK_REPO_URL}/issues/new?${params.toString()}`;
}

export async function openFeedbackForm(args: BuildFeedbackUrlArgs): Promise<void> {
  const url = buildFeedbackUrl(args);

  if (isTauri()) {
    try {
      await open(url);
      return;
    } catch (error) {
      console.error('Error opening feedback URL via Tauri:', error);
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
