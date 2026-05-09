import { test, expect } from '@playwright/test';

// Define the test credentials provided
const EMAIL = 'lakshbetala15@gmail.com';
const PASSWORD = 'Laksh2804!';

test.describe('Marketplace Golden Path', () => {
  
  test('Company can log in, post a gig, and view it in dashboard', async ({ browser }) => {
    // 1. Setup Company Context
    const companyContext = await browser.newContext();
    const companyPage = await companyContext.newPage();
    
    // 2. Login
    await companyPage.goto('/login');
    await companyPage.fill('input[type="email"]', EMAIL);
    await companyPage.fill('input[type="password"]', PASSWORD);
    
    // Adjust selector based on actual login button text/id
    await companyPage.click('button:has-text("Sign In"), button[type="submit"]');
    
    // Wait for navigation to dashboard or home
    await companyPage.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
    
    // 3. Navigate to Company Dashboard
    await companyPage.goto('/company/dashboard');
    
    // Verify Company Dashboard loaded
    await expect(companyPage.locator('text=Active Postings').first()).toBeVisible();
    
    // 4. Post a Gig
    await companyPage.goto('/company/post');
    await expect(companyPage.locator('text=Task Title')).toBeVisible();
    
    // Fill out the gig form
    await companyPage.fill('input[placeholder*="Title"]', 'Playwright Automated E2E Test Task');
    await companyPage.fill('textarea[placeholder*="Description"]', 'This is an automated test verifying the golden path.');
    await companyPage.fill('input[type="number"]', '500'); // Price
    
    // Submit (Click Deploy/Post Task)
    await companyPage.click('button:has-text("Post Task")');
    
    // Should redirect to company dashboard or gig page
    await companyPage.waitForURL('**/company/dashboard**', { timeout: 10000 }).catch(() => {});
    
    // Verify the gig is in the dashboard
    await companyPage.goto('/company/dashboard');
    await expect(companyPage.locator('text=Playwright Automated E2E Test Task').first()).toBeVisible();
    
    await companyContext.close();
  });

  test.skip('Worker can apply to the gig and Company can hire', async ({ browser }) => {
    // TODO: Requires a second dedicated test worker account.
    // 1. Login as Worker
    // 2. Go to /feed, find 'Playwright Automated E2E Test Task'
    // 3. Click Apply, fill pitch, submit
    // 4. Login as Company
    // 5. Go to Task Hub
    // 6. Accept Worker (Escrow)
    // 7. Verify Optimistic UI (No reload occurred)
  });
});
