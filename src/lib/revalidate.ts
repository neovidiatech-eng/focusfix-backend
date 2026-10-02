import { logger } from './logger';

export async function triggerRevalidation(tags: string[], paths: string[] = []) {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET || 'focusfix_revalidate_secret';

  try {
    const res = await fetch(`${webUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags, paths }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, tags }, 'Revalidation endpoint returned non-200');
    } else {
      logger.info({ tags, paths }, 'Revalidation triggered successfully');
    }
  } catch (error) {
    logger.error({ error, tags }, 'Failed to trigger revalidation');
  }
}
