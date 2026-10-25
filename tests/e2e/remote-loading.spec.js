import { test, expect } from '@playwright/test';

const manifestForVersion = (version) => ({
    remotes: {
        consultingOpportunities: {
            repository: 'HenrikGr/consulting-opportunities',
            federationName: 'consultingOpportunities',
            exposes: ['./FeatureButton'],
            currentVersion: {
                tag: version,
                status: 'available',
            },
        },
    },
});

test('Host loads and displays the configured Remote version', async ({ page }) => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'hgc-ab' })
    ).toBeVisible();

    await expect(
        page.getByRole('heading', { name: 'Remote feature area' })
    ).toBeVisible();

    await expect(page.getByRole('button').first()).toBeVisible();
});

test('Host displays a fallback when Remote is unavailable', async ({ page }) => {
    await page.route('**/consultingOpportunitiesEntry.js', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText(
        'Remote feature unavailable.'
    );

    // A Remote failure must not remove the Host shell.
    await expect(
        page.getByRole('heading', { name: 'hgc-ab' })
    ).toBeVisible();
});

test('Host displays a configuration error when no remotes are configured', async ({ page }) => {
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

test('Host can load current and fallback versions through runtime configuration', async ({ browser }) => {
    // Fresh pages avoid reusing modules cached by the federation runtime.
    // Prepare both versions before running this test.
    for (const version of ['1.0.4', '1.0.3']) {
        const page = await browser.newPage();

        await page.route('**/microfrontends.json', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(manifestForVersion(version)),
            });
        });

        await page.goto('/');

        await expect(
            page.getByRole('button').first()
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
    await page.getByRole('button').first().click();

    await expect.poll(() =>
        page.evaluate(() => window.__remotePocClicked)
    ).toBe(true);
});
