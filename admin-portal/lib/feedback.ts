export const FEEDBACK_REPO_URL = 'https://github.com/Samsuesca/uniformes-feedback';

export type FeedbackTemplate = 'bug_report' | 'feature_request' | 'ux_feedback';

interface BuildFeedbackUrlArgs {
  template: FeedbackTemplate;
  section?: string;
  platform?: string;
  appVersion?: string;
}

export function buildFeedbackUrl({ template, section, platform, appVersion }: BuildFeedbackUrlArgs): string {
  const params = new URLSearchParams({ template: `${template}.yml` });
  if (section) params.set('section', section);
  if (platform) params.set('platform', platform);
  if (appVersion) params.set('app_version', appVersion);
  return `${FEEDBACK_REPO_URL}/issues/new?${params.toString()}`;
}

export function openFeedbackForm(args: BuildFeedbackUrlArgs): void {
  if (typeof window === 'undefined') return;
  window.open(buildFeedbackUrl(args), '_blank', 'noopener,noreferrer');
}
