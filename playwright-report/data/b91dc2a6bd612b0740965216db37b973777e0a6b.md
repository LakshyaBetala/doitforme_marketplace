# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: golden-path.spec.ts >> Marketplace Golden Path >> Company can log in, post a gig, and view it in dashboard
- Location: tests\golden-path.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Task Title')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Task Title')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - img
  - region "Notifications alt+T"
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - link "DoItForMe DoItForMe Enterprise Hub" [ref=e6] [cursor=pointer]:
            - /url: /
            - img "DoItForMe" [ref=e8]
            - generic [ref=e9]:
              - generic [ref=e10]: DoItForMe
              - generic [ref=e11]: Enterprise Hub
          - generic [ref=e12]:
            - img [ref=e13]
            - textbox "Search deployments..." [ref=e16]
        - generic [ref=e17]:
          - button [ref=e18] [cursor=pointer]:
            - img [ref=e19]
          - button "T Test Company" [ref=e22] [cursor=pointer]:
            - generic [ref=e24]: T
            - generic [ref=e25]: Test Company
            - img [ref=e26]
      - main [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]:
            - img [ref=e31]
            - generic [ref=e33]:
              - heading "Awaiting Enterprise Clearance" [level=3] [ref=e34]
              - paragraph [ref=e35]: Your organizational credentials are currently undergoing manual verification. Authorization to deploy multi-worker tasks is pending administrator approval.
          - generic [ref=e36]:
            - generic [ref=e37]:
              - generic [ref=e38]: Dashboard Overview
              - heading "Test Company" [level=1] [ref=e39]
            - link "Deploy Task" [ref=e41]:
              - /url: "#"
              - img [ref=e42]
              - text: Deploy Task
          - generic [ref=e43]:
            - generic [ref=e44]:
              - heading "Active Postings" [level=2] [ref=e45]: Active Postings
              - generic [ref=e47]: 0 UNITS
            - generic [ref=e48]:
              - img [ref=e49]
              - paragraph [ref=e53]: No active deployments detected.
  - button "Open Next.js Dev Tools" [ref=e59] [cursor=pointer]:
    - img [ref=e60]
  - alert [ref=e63]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // Define the test credentials provided
  4  | const EMAIL = 'lakshbetala15@gmail.com';
  5  | const PASSWORD = 'Laksh2804!';
  6  | 
  7  | test.describe('Marketplace Golden Path', () => {
  8  |   
  9  |   test('Company can log in, post a gig, and view it in dashboard', async ({ browser }) => {
  10 |     // 1. Setup Company Context
  11 |     const companyContext = await browser.newContext();
  12 |     const companyPage = await companyContext.newPage();
  13 |     
  14 |     // 2. Login
  15 |     await companyPage.goto('/login');
  16 |     await companyPage.fill('input[type="email"]', EMAIL);
  17 |     await companyPage.fill('input[type="password"]', PASSWORD);
  18 |     
  19 |     // Adjust selector based on actual login button text/id
  20 |     await companyPage.click('button:has-text("Sign In"), button[type="submit"]');
  21 |     
  22 |     // Wait for navigation to dashboard or home
  23 |     await companyPage.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  24 |     
  25 |     // 3. Navigate to Company Dashboard
  26 |     await companyPage.goto('/company/dashboard');
  27 |     
  28 |     // Verify Company Dashboard loaded
  29 |     await expect(companyPage.locator('text=Active Postings').first()).toBeVisible();
  30 |     
  31 |     // 4. Post a Gig
  32 |     await companyPage.goto('/company/post');
> 33 |     await expect(companyPage.locator('text=Task Title')).toBeVisible();
     |                                                          ^ Error: expect(locator).toBeVisible() failed
  34 |     
  35 |     // Fill out the gig form
  36 |     await companyPage.fill('input[placeholder*="Title"]', 'Playwright Automated E2E Test Task');
  37 |     await companyPage.fill('textarea[placeholder*="Description"]', 'This is an automated test verifying the golden path.');
  38 |     await companyPage.fill('input[type="number"]', '500'); // Price
  39 |     
  40 |     // Submit (Click Deploy/Post Task)
  41 |     await companyPage.click('button:has-text("Post Task")');
  42 |     
  43 |     // Should redirect to company dashboard or gig page
  44 |     await companyPage.waitForURL('**/company/dashboard**', { timeout: 10000 }).catch(() => {});
  45 |     
  46 |     // Verify the gig is in the dashboard
  47 |     await companyPage.goto('/company/dashboard');
  48 |     await expect(companyPage.locator('text=Playwright Automated E2E Test Task').first()).toBeVisible();
  49 |     
  50 |     await companyContext.close();
  51 |   });
  52 | 
  53 |   test.skip('Worker can apply to the gig and Company can hire', async ({ browser }) => {
  54 |     // TODO: Requires a second dedicated test worker account.
  55 |     // 1. Login as Worker
  56 |     // 2. Go to /feed, find 'Playwright Automated E2E Test Task'
  57 |     // 3. Click Apply, fill pitch, submit
  58 |     // 4. Login as Company
  59 |     // 5. Go to Task Hub
  60 |     // 6. Accept Worker (Escrow)
  61 |     // 7. Verify Optimistic UI (No reload occurred)
  62 |   });
  63 | });
  64 | 
```