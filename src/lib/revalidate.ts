import { logger } from './logger';

export async function triggerRevalidation(tags: string[], paths: string[] = []) {
  const webUrl = process.env.WEB_URL || 'https://focusfix-public.vercel.app';
  const secret = process.env.REVALIDATE_SECRET || 'focusfix_revalidate_secret';

  const finalPaths = [...paths];
  if (tags.some((t) => t.startsWith('blog')) && !finalPaths.includes('/blog')) {
    finalPaths.push('/blog');
  }

  try {
    const res = await fetch(`${webUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags, paths: finalPaths }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, tags, paths: finalPaths }, 'Revalidation endpoint returned non-200');
    } else {
      logger.info({ tags, paths: finalPaths }, 'Revalidation triggered successfully');
    }
  } catch (error) {
    logger.error({ error, tags, paths: finalPaths }, 'Failed to trigger revalidation');
  }
}
