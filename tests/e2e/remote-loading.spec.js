
import { test, expect } from '@playwright/test';

test('Host loads and displays the Remote feature', async ({ page }) => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Host PoC' })
    ).toBeVisible();

    await expect(
        page.getByText('Remote feature — v1.0.0')
    ).toBeVisible();
});



test('Host displays a fallback when Remote is unavailable', async ({ page }) => {
    await page.route('**/remoteEntry.js', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/');

    await expect(
        page.getByRole('alert')
    ).toContainText('Remote feature unavailable.');
});
