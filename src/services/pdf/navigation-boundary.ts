import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';

import { PdfErrorMessage } from './constants.ts';

import type { BrowserContext, Page } from 'playwright';

/** CDP intercepts each document request, including redirect hops that Playwright routes skip. */
export async function navigationBoundary(context: BrowserContext, page: Page, origin: string) {
  let rejectNavigation: (error: unknown) => void;
  const failure = new Promise<never>((_resolve, reject) => {
    rejectNavigation = reject;
  });
  const blocked = (blockedUrl: string, reason: string) =>
    new AppError(502, ErrorCode.NavigationBlocked, PdfErrorMessage.NavigationBlocked, {
      details: { blockedUrl, allowedOrigin: origin, reason },
    });
  // Popups can start navigating before a page-specific CDP session can attach.
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest()) {
      let reason: string | undefined;
      try {
        if (new URL(request.url()).origin !== origin) reason = 'cross_origin_navigation';
        else if (request.frame().page() !== page) reason = 'popup_or_other_page';
      } catch {
        // A navigation without an attached frame is not safe to admit.
        reason = 'detached_frame';
      }
      if (reason) {
        rejectNavigation(blocked(request.url(), reason));
        await route.abort('blockedbyclient');
        return;
      }
    }
    await route.continue();
  });
  const session = await context.newCDPSession(page);
  session.on('Fetch.requestPaused', (event: { requestId: string; request: { url: string } }) => {
    const resume = async () => {
      if (new URL(event.request.url).origin !== origin) {
        rejectNavigation(blocked(event.request.url, 'cross_origin_document_or_redirect'));
        await session.send('Fetch.failRequest', {
          requestId: event.requestId,
          errorReason: 'BlockedByClient',
        });
      } else {
        await session.send('Fetch.continueRequest', {
          requestId: event.requestId,
        });
      }
    };
    void resume().catch(rejectNavigation);
  });
  await session.send('Fetch.enable', {
    patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Request' }],
  });
  return { failure };
}
