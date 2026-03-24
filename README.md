# AFLS Mobile DB

A diagnostic Intelligent Content (IC) presentation for the Life Sciences Cloud (LSC) iPad app. It helps consultants inspect the local SQLite database on the device to troubleshoot configuration issues.

## Demo

https://raw.githubusercontent.com/afls-ideas/AFLS_LocalDB_QueryTool/main/assets/QueryToolScreens.mp4

## Features

### Object Browser (default tab)
- Browse all common LSC objects (45+ objects)
- Select fields via checkboxes and generate SOQL queries
- Quickly discover what data exists in the local database

### Query Tool
- Run SOQL queries directly against the local database
- Pre-built query templates for common objects (HCP, Account, Visit, etc.)
- Auto-pagination for large result sets (100 records per batch)

### Healthcheck
- 8 automated rules that validate common configuration issues
- Checks: IsPrimaryProvider flag, active providers, primary affiliations, primary addresses, territory assignments, visit status, sample limits, consent records
- Results: PASS / FAIL / WARN / SKIP with detailed record-level output

## How to Deploy

### 1. Create the ZIP

```bash
cd IC_Healthcheck
zip -r 01_QueryTool.zip 01_QueryTool/ -x "01_QueryTool/.DS_Store" "01_QueryTool/**/.DS_Store"
```

### 2. Upload as an IC Presentation

1. In Salesforce, go to **App Launcher > Presentations** (or navigate to the Presentation object)
2. Click **New** to create a new Presentation record
3. Fill in:
   - **Name**: AFLS Mobile DB
   - **IsActive**: checked
4. Save the record
5. Under the **Presentation Pages** related list, upload `01_QueryTool.zip` as an attachment or use the file upload mechanism for IC content
6. The ZIP must contain the folder `01_QueryTool/` at the root, with `01_Healthcheck.html` inside it

### 3. Distribute to Users

- Assign the presentation to a **Territory** so reps in that territory can access it
- Or assign it **globally** if all users should have access
- Users open the LSC iPad app, go to the **Content Player** (IC section), and tap the presentation

### 4. Open on iPad

- The presentation opens in the IC content player
- It automatically detects the device environment and shows **"On Device"** badge
- All queries run against the local SQLite database via `PresentationPlayer.fetchWithParams()`

## Desktop Testing

When opened in a desktop browser (not on the iPad), mock data is returned so the UI can be tested without a device. The badge will show **"Desktop Mode"**.

## File Structure

```
01_QueryTool/
  01_Healthcheck.html   - Single-page app (HTML + CSS + JS inline)
  js/
    bridge.js           - PresentationPlayer.fetchWithParams() abstraction layer
    healthcheck.js      - Healthcheck rules engine (8 rules)
  fonts/                - Montserrat font files (offline use)
```

## Prerequisites

- User must have **Read permissions** on the objects being queried
- Objects must have active **DB Schema** (object metadata cache) records in the Admin Console
- Objects must be **synced** to the LSC mobile app

## Adding New Healthcheck Rules

Edit `js/healthcheck.js` and add a new entry to the `rules` array. See `HEALTHCHECK_RULES.md` for the full rule specification and examples.

## Technical Details

- Pure vanilla JavaScript - no external dependencies
- Uses `PresentationPlayer.fetchWithParams(query, params, callbackMethodName)` API
- Callback names must be global function name strings (not function references)
- Max 100 records per batch, bridge auto-paginates through all results
- Initialization via `PresentationDOMContentLoaded` event on device
