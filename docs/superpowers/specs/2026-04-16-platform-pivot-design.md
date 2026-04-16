# DoItForMe Platform Pivot Design

## Overview
The platform is pivoting away from a traditional marketplace structure toward a **zero-commission connection hub** with an optional **escrow guarantee**. The core philosophy is to facilitate trust and communication between Posters and Hustlers. Hustlers choose their preferred payment method during application, and the platform manages the state of the job through an Activity Hub and a 24-hour auto-release escrow mechanism.

## Core Workflows

### 1. Application & Payment Preference
When a Hustler applies to a post, they are presented with a primary choice:
- **Direct Connect (Free):** The hustler simply shares their WhatsApp/phone number. The poster can contact them directly. The platform does not manage the payment.
- **Escrow Guarantee (2% Fee):** The platform holds the funds via Cashfree. The 2% fee is deducted. **Note:** Escrow is only available for jobs with a value of ₹500 or more.

### 2. Application Review (Poster Side)
Posters review incoming applications via an **Expanded Profile Card/Drawer**. 
- It displays the applicant's complete profile, past projects, experience, and their chosen payment preference (Escrow vs Direct Connect).
- The Poster selects an applicant and clicks **Approve/Hire**. 

### 3. Communication & Connection
- **Pre-hire:** Posters and applicants can communicate via the in-app chat (`/messages`) to clarify requirements.
- **Post-hire:** Upon the Poster clicking "Approve", the platform instantly unlocks and exchanges the WhatsApp/phone numbers of both parties. 

### 4. Escrow Lifecycle & 24-hour Auto-Release
If the "Escrow" route is chosen:
1. **Funding:** The Poster navigates to their Activity Hub (`/gig/my-gigs`) to fund the amount into the Cashfree Escrow.
2. **Submission:** Upon completing the task, the Hustler clicks "Submit Work" via the Activity Hub.
3. **Review & Auto-Release:** The Poster gets a notification and has exactly **24 hours** to review the work (Yes/No). 
   - Accept (Yes) -> Escrow is immediately released to the Hustler.
   - Reject (No) -> Enters a dispute mechanism.
   - No action -> The system automatically approves and releases the funds to the Hustler after 24 hours.

## Architecture & UI Approach

We will utilize the **Dashboard + Chat Architecture** (keeping the current UI structure).
- **Dashboard (`/dashboard`):** Remains the primary feed for discovering opportunities, powered by the existing filters and live tasks.
- **Activity Hub (`/gig/my-gigs`):** The control center for active jobs. It tracks states like "Awaiting Escrow Funding", "In Progress", "Submitted (24hr timer running)", and "Disputed".
- **Messaging (`/messages`):** Acts as the 24/7 communication layer. It will contain quick links to the Activity Hub for users to easily trigger state changes. 

## Open Questions / Clarifications
- **Dispute Mechanism:** The actual flow of the dispute mechanism (admin intervention vs automated partial refunds) will need to be defined in a subsequent spec if it goes beyond basic manual admin resolution.

## Spec Review
- Contains no ambiguous placeholders.
- Internal flow matches the user requirements (24-hour timer, Escrow threshold, Dashboard retention).
- Scope is focused strictly on the connection/escrow pivot logic.
