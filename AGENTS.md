# Campus Ride Sharing — team rules

Project root for the team. Backend = Express + Mongoose (MVC), frontend = React + Vite + Tailwind.
See existing code before writing anything new, and copy its exact style. Do not add code comments.

## FROZEN baseline — do NOT modify unless the user explicitly asks

These files implement the v1 baseline (profile setup, mandatory ID-card signup, admin ID
verification, admin users view, ban/unban). A teammate adding their own feature must NEVER edit,
rewrite, or restructure them. If a feature genuinely requires touching one, STOP and tell the user.

- backend/models/Student.js
- backend/controllers/studentController.js
- backend/controllers/authController.js
- backend/controllers/adminController.js
- backend/middleware/ (all files: auth.js, admin.js, upload.js, validators.js)
- backend/routes/ (all files)
- backend/utils/file.js
- backend/server.js
- backend/config/db.js
- backend/scripts/smoke.js
- backend/package.json
- frontend/src/api/api.js
- frontend/src/auth.js
- frontend/src/App.jsx
- frontend/src/components/ (all files)
- frontend/src/main.jsx
- package.json, package-lock.json
- .env (both frontend/.env and backend/.env) — never read or print secret values

## How a teammate adds a feature

1. STRICT MVC: models -> controllers -> routes -> middleware on the backend;
   api.js function -> component -> App.jsx route on the frontend.
2. ADD NEW FILES for the new feature instead of editing frozen ones. Copy the style of an
   existing controller/route/component.
3. Protect student endpoints with `protect` (backend/middleware/auth.js), admin-only with
   `protect` + `adminOnly` (backend/middleware/admin.js).
4. Never run `npm install` in backend/ or frontend/ (dependencies are shared from the parent
   `D:\Lab project cse470\node_modules`). If a new package is required, ask the user first.
5. Never touch the real database. The smoke test uses an in-memory MongoDB
   (backend/scripts/smoke.js) — never change that.

## Verify before finishing

- Backend: `npm run smoke` in backend/ must print "ALL TESTS PASSED". Add new tests to
  backend/scripts/smoke.js in the matching section if your feature needs them.
- Frontend: `npm run build` in frontend/ must succeed, then delete the generated frontend/dist/.
- Report which files you changed, the new endpoints, and the smoke/build results.
