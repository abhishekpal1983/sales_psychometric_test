# Topmate Sales Profile Screener

A gamified psychometric screener for sales agent and manager hiring. Candidates play three levels; scoring happens on the server; results are stored in Postgres and visible only behind an admin password.

```
public/index.html   candidate game (no scoring keys in it)
public/admin.html   your private evaluator
src/server.js       Express API and static hosting
src/scoring.js      scales, keys and validity rules (server only)
```

## Deploy on Railway

1. Create a GitHub repository (private) and push this folder to it.
2. In Railway: New Project, Deploy from GitHub repo, pick the repository. Railway detects Node and runs `npm start`.
3. In the same project click New, Database, PostgreSQL. Railway creates `DATABASE_URL` on the database service.
4. Open your web service, Variables tab, and add:
   - `ADMIN_PASSWORD` = a long passphrase only you know
   - `DATABASE_URL` = click Add Reference and choose the Postgres service's `DATABASE_URL`
5. Settings tab, Networking, Generate Domain. You get a URL like `https://something.up.railway.app`.
6. Redeploy if the first deploy ran before the variables existed.

## Links to share

- Agent candidates: `https://your-domain/`
- Manager candidates: `https://your-domain/#manager`
- You only: `https://your-domain/admin`

## Local run

```
npm install
ADMIN_PASSWORD=test DATABASE_URL=postgres://user:pass@localhost:5432/screener npm start
```

## Changing the test

Item text lives in `public/index.html` (arrays `L`, `M`, `FC`, `SJ`). Scale membership, reverse scoring, attention check answers, situational keys and cut offs live in `src/scoring.js`. Keep item ids stable so old results stay comparable.
