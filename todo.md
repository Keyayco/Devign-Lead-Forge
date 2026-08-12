# Project TODO

- [x] Create the leads database table with exact business fields: name, contact, email, address, type, demo link, claimed-by identity, claimed-at timestamp, created-at timestamp, and updated-at timestamp.
- [x] Generate the Drizzle migration and apply the leads schema to the project database.
- [x] Add typed database helpers for listing, creating, updating, deleting, and atomically claiming leads.
- [x] Add protected tRPC procedures for full lead CRUD and claim status handling with one-way locking.
- [x] Enforce claim locking server-side so a lead can only be claimed when it is unclaimed; prevent non-owners from modifying or deleting claimed leads.
- [x] Use Manus OAuth identity for authenticated agent access and show the signed-in agent in the dashboard.
- [x] Build the internal dashboard shell with persistent sidebar navigation and a polished, accessible visual system.
- [x] Build the leads table with exact visible column names: Name, Contact, Email, Address, Type, and Demo Link.
- [x] Add a visible claim status area and claim action that clearly identifies the claiming agent and locks claimed leads.
- [x] Add lead create and edit forms with validation for all requested fields.
- [x] Add delete confirmation flow and clear success/error feedback.
- [x] Add search by lead name and filtering by type and claimed/unclaimed status.
- [x] Add loading, empty, error, and responsive states for the leads view.
- [x] Add Vitest coverage for CRUD procedure validation and claim-locking behavior.
- [x] Run type checks, tests, and build verification.
- [x] Capture desktop and mobile screenshots to verify visual quality and accessibility.
- [x] Save the completed project checkpoint and provide the user with the version attachment.

## Decisions and assumptions

- The tool is an authenticated internal application for approximately 5–10 agents.
- Any authenticated agent may create, read, update, and delete unclaimed leads.
- Once claimed, a lead is locked to the claiming agent's identity; other agents cannot claim it or modify/delete it.
- The exact column labels requested by the user are preserved in the table UI.
- No fake customer reviews, ratings, or testimonials are included.
