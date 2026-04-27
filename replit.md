# Dog & Cat Registration System (ระบบลงทะเบียนสุนัขและแมว)

## Project Overview
A web application for Bang Kaeo Municipality (เทศบาลเมืองบางแก้ว) to manage dog and cat registrations, vaccination tracking, and stray animal reporting.

## Tech Stack
- **Original Platform:** Google Apps Script (serverless, runs on Google's infrastructure)
- **Database:** Google Sheets
- **File Storage:** Google Drive
- **Frontend Libraries:** Bootstrap (custom), SweetAlert2, Leaflet.js (maps), Chart.js
- **Preview Server:** Node.js (server.js) — assembles the Google Apps Script HTML templates for local preview

## Architecture
This is a Google Apps Script project. The `.gs` files contain server-side logic and the `.html` files contain frontend components. The project uses a template include system (`<?!= include('...'); ?>`) that only works inside Google Apps Script.

For Replit preview, `server.js` assembles all HTML parts into one complete page and serves it on port 5000.

## Key Files
- `server.js` — Node.js static assembly server for preview (port 5000)
- `Code.gs` — Entry point (`doGet`), global constants, sheet initialization
- `Auth.gs` — Authentication and session management
- `CRUD_Member.gs` — Pet owner / member CRUD operations
- `Index.html` — Main SPA container
- `Style.html` — Global CSS
- `JavaScript.html` — Global client-side JS
- `JS_Public.html` — Public dashboard JS
- `JS_Auth.html` — Auth flow JS
- `JS_Member.html` — Member dashboard JS
- `JS_Admin.html` — Admin dashboard JS
- `JS_Stray.html` — Stray animal reporting JS
- `Sync_GitHub.gs` — GitHub→GAS self-update sync (admin-only button on dashboard)
- `appsscript.json` — Apps Script manifest (OAuth scopes, web app settings)

## Running Locally
```
node server.js
```
Serves on `http://0.0.0.0:5000`

## Deployment
The true deployment target is Google Apps Script. The Replit preview is for development reference only. Backend calls to `google.script.run` are stubbed out with no-op handlers in the preview.

## clasp Push (No Shell Required)
Workflow **"Push to GAS"** (`scripts/push-to-gas.js`) runs `clasp push --force`
using credentials passed via either:
- Secret `CLASPRC_JSON` (paste contents in Replit Secrets UI), or
- A file `clasprc.json` in workspace root (drag-drop from local machine)

Script ID is read from `.clasp.json` in workspace root, or Secret `GAS_SCRIPT_ID`.
The script writes the auth file to a tempdir (mode 0600), runs clasp with `-A`/`-P`
flags, and removes the temp file after. A `.claspignore` is auto-generated to
include only `*.gs`, `*.html`, and `appsscript.json`.

**One-time setup**:
1. Run `clasp login` once on a personal computer with a browser (creates
   `~/.clasprc.json`)
2. Either drag `~/.clasprc.json` into Replit and rename to `clasprc.json`, or
   paste its contents into Replit Secret `CLASPRC_JSON`
3. Add Script ID to Secret `GAS_SCRIPT_ID` (or `.clasp.json`)
4. Click "Run" on the "Push to GAS" workflow whenever you want to push

## GitHub → GAS Sync (No Shell Required)
Admin dashboard tab "🔄 Sync โค้ดจาก GitHub" lets the script overwrite its own
source files with the latest version from a configured GitHub repo, using
the Apps Script API (`projects.updateContent`) and the user's OAuth token via
`ScriptApp.getOAuthToken()`. All sync RPCs require an Admin session token
(validated through `Auth.gs#checkSession`). Configuration is stored in
Script Properties: `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN` (only for
private repos). One-time setup: enable the Apps Script API in the Google
account, then re-authorize the script after the new OAuth scopes
(`script.external_request`, `script.projects`) are added.
