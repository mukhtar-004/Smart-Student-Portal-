# Smart Student Portal (Frontend Capstone)

## Overview
Single-page front-end web app built with **HTML, CSS, and JavaScript** to let a student register/login (client-side), manage profile, courses, assignments/submissions, attendance, and generate a printable report card. Data persists in `localStorage`.

This starter implements all **required features** and two **nice-to-have** extras:
- Dark mode toggle (saved preference)
- Import/Export data as JSON

## Files
- `index.html` — main markup and UI
- `styles.css` — styling, responsive rules, and print stylesheet
- `app.js` — app logic and data handling (single-file modular pattern)
- `README.md` — this file

## How to run
1. Save files in a folder.
2. Open `index.html` in a browser. (If your browser blocks some modern features on `file://`, run a tiny static server: `npx serve` or `python -m http.server`.)
3. Use the Register tab to create an account — you will be logged in automatically.

## Data & Persistence
All data is stored under the `localStorage` key `smart_student_portal_v1`. The structure:

```json
{
  "users": [ { "id","username","email","passwordEncoded","profile":{name,bio,picDataURL} } ],
  "sessions": { "currentUserId": "user_..." },
  "courses": [ { id, title, instructor, credits, semester, grade } ],
  "assignments": [ { id, courseId, title, due, points, desc, submissions: [ {id, text, fileDataURL, ts} ] } ],
  "attendance": [ { id, courseId, date, status } ],
  "preferences": { "darkMode": false }
}
