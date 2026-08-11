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

Locator: locator('text=Active Postings').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Active Postings').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - img
  - region "Notifications alt+T"
  - main [ref=e2]:
    - generic [ref=e4]:
      - img "Logo" [ref=e7]
      - heading "Welcome Back" [level=1] [ref=e8]
      - paragraph [ref=e9]: Login to continue your hustle.
      - button "Continue with Google" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
        - text: Continue with Google
      - generic [ref=e18]: or
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]:
            - button "Password" [ref=e23] [cursor=pointer]
            - button "OTP / Magic Link" [ref=e24] [cursor=pointer]
          - textbox "Enter your email" [ref=e25]
          - generic [ref=e26]:
            - textbox "Enter password" [ref=e27]
            - button [ref=e28] [cursor=pointer]:
              - img [ref=e29]
        - button "Login" [ref=e33] [cursor=pointer]
      - generic [ref=e34]:
        - paragraph [ref=e35]:
          - text: Don't have an account?
          - button "Sign Up" [ref=e36] [cursor=pointer]
        - generic [ref=e37]:
          - paragraph [ref=e38]: Hiring Talent?
          - link "Company Company Portal Login as an Enterprise" [ref=e39] [cursor=pointer]:
            - /url: /company/login
            - generic [ref=e40]:
              - img "Company" [ref=e42]
              - generic [ref=e43]:
                - paragraph [ref=e44]: Company Portal
                - paragraph [ref=e45]: Login as an Enterprise
            - img [ref=e46]
  - button "Open Next.js Dev Tools" [ref=e53] [cursor=pointer]:
    - img [ref=e54]
  - alert [ref=e57]
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
> 29 |     await expect(companyPage.locator('text=Active Postings').first()).toBeVisible();
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  30 |     
  31 |     // 4. Post a Gig
  32 |     await companyPage.goto('/company/post');
  33 |     await expect(companyPage.locator('text=Task Title')).toBeVisible();
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