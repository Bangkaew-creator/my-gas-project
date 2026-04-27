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
- `appsscript.json` — Apps Script manifest (OAuth scopes, web app settings)

## Running Locally
```
node server.js
```
Serves on `http://0.0.0.0:5000`

## Deployment
The true deployment target is Google Apps Script. The Replit preview is for development reference only. Backend calls to `google.script.run` are stubbed out with no-op handlers in the preview.
