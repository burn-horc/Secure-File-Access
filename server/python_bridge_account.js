const fs = require('fs');
const NetflixAccountChecker = require('./main');

async function run() {
  try {
    const stdin = fs.readFileSync(0, 'utf8');
    const payload = stdin ? JSON.parse(stdin) : {};
    const cookieHeader =
      typeof payload.cookieHeader === 'string' ? payload.cookieHeader.trim() : '';

    if (!cookieHeader) {
      throw new Error('Missing cookieHeader input');
    }

    const checker = new NetflixAccountChecker();
    const response = await checker.fetchAccountHtml(cookieHeader);
    const status = Number(response?.status ?? 0);
    if (status !== 200) {
      process.stdout.write(
        JSON.stringify({
          ok: true,
          result: {
            valid: false,
            reason: `HTTP ${status || 'unknown'}`,
            loggedIn: false,
            hasSignals: false,
          },
        })
      );
      return;
    }

    const html =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data ?? '');
    const finalUrl = checker.getFinalResponseUrl(response);
    const account = checker.extractAccountData(html);
    const publicData = checker.toPublicResult(account);
    const loggedIn = checker.isLoggedIn(html, finalUrl);
    const hasSignals = checker.hasRealAccountSignals(account);
    const membershipStatus = String(account?.membershipStatus || '')
      .trim()
      .toUpperCase();

    let reason = null;
    if (!loggedIn && !hasSignals) {
      reason = `Not logged in (${finalUrl || 'unknown-url'})`;
    } else if (membershipStatus === 'ANONYMOUS') {
      reason = 'Anonymous membership (logged out)';
    }

    const result = {
      ...publicData,
      valid: reason ? false : Boolean(publicData.valid),
      reason,
      loggedIn,
      hasSignals,
    };

    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(JSON.stringify({ ok: false, error: message }));
    process.exitCode = 1;
  }
}

run();
