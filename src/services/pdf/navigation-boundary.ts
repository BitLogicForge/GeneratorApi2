import { ErrorCode, ErrorMessage } from '@/constants';
import { AppError } from '@/errors';

import type { BrowserContext, Page } from 'playwright';

/** CDP intercepts each document request, including redirect hops that Playwright routes skip. */
export async function navigationBoundary(
  context: BrowserContext,
  page: Page,
  origin: string,
) {
  let rejectNavigation: (error: unknown) => void;
  const failure = new Promise<never>((_resolve, reject) => {
    rejectNavigation = reject;
  });
  const blocked = () =>
    new AppError(
      502,
      ErrorCode.NavigationBlocked,
      ErrorMessage.NavigationBlocked,
    );
  // Popups can start navigating before a page-specific CDP session can attach.
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest()) {
      let permitted = false;
      try {
        permitted =
          new URL(request.url()).origin === origin &&
          request.frame().page() === page;
      } catch {
        // A navigation without an attached frame is not safe to admit.
      }
      if (!permitted) {
        rejectNavigation(blocked());
        await route.abort('blockedbyclient');
        return;
      }
    }
    await route.continue();
  });
  const session = await context.newCDPSession(page);
  session.on(
    'Fetch.requestPaused',
    (event: { requestId: string; request: { url: string } }) => {
      const resume = async () => {
        if (new URL(event.request.url).origin !== origin) {
          rejectNavigation(blocked());
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
    },
  );
  await session.send('Fetch.enable', {
    patterns: [
      { urlPattern: '*', resourceType: 'Document', requestStage: 'Request' },
    ],
  });
  return { failure };
}
