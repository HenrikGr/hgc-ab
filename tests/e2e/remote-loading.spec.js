import { test, expect } from '@playwright/test';

const remoteEntry = (version) =>
    `http://localhost:5002/remotes/remoteApp/${version}/remoteEntry.js`;

test('Host loads and displays the configured Remote version', async ({ page }) => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Host PoC' })
    ).toBeVisible();

    await expect(
        page.getByRole('heading', { name: 'Remote feature area' })
    ).toBeVisible();

    await expect(
        page.getByRole('button', { name: 'Remote feature — v1.0.2' })
    ).toBeVisible();
});

test('Host displays a fallback when Remote is unavailable', async ({ page }) => {
    await page.route('**/remoteEntry.js', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText(
        'Remote feature unavailable.'
    );

    // A Remote failure must not remove the Host shell.
    await expect(
        page.getByRole('heading', { name: 'Host PoC' })
    ).toBeVisible();
});

test('Host displays a configuration error when remoteApp is missing', async ({ page }) => {
    await page.route('**/microfrontends.json', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        });
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText(
        'Runtime configuration could not be loaded.'
    );
});

test('Host can select a Remote version and roll back through runtime configuration', async ({ browser }) => {
    // Fresh pages avoid reusing modules cached by the federation runtime.
    // Both immutable artifacts must be present under local-remotes.
    for (const version of ['1.0.2', '1.0.1']) {
        const page = await browser.newPage();

        await page.route('**/microfrontends.json', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ remoteApp: remoteEntry(version) }),
            });
        });

        await page.goto('/');

        const expectedLabel =
            version === '1.0.1'
                ? 'Remote feature — v1.0.0'
                : `Remote feature — v${version}`;

        await expect(
            page.getByRole('button', { name: expectedLabel })
        ).toBeVisible();

        await page.close();
    }
});

test('Remote feature button dispatches its click event', async ({ page }) => {
    await page.addInitScript(() => {
        window.__remotePocClicked = false;
        window.addEventListener('remote-poc:clicked', () => {
            window.__remotePocClicked = true;
        });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Remote feature — v1.0.2' }).click();

    await expect.poll(() =>
        page.evaluate(() => window.__remotePocClicked)
    ).toBe(true);
});
