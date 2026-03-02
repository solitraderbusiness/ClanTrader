---
name: deploy
description: Build, lint, and pack the application for deployment to Iran VPS
disable-model-invocation: true
allowed-tools: Bash(npm run lint), Bash(npm run build), Bash(bash scripts/deploy-pack.sh), Bash(ls -lh deploy.tar.gz), Bash(pm2 restart *), Bash(curl *), Bash(pm2 logs *), Read, Glob
---

Deploy preparation steps:

1. Run `npm run lint` — must have 0 errors (warnings OK)
2. Run `npm run build` — must compile cleanly
3. Run `bash scripts/deploy-pack.sh` — creates deploy.tar.gz
4. Report the tarball size with `ls -lh deploy.tar.gz`
5. Restart the local dev server: `pm2 restart clantrader`
6. Wait 8 seconds, then verify health: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health`
7. Check PM2 logs for startup errors: `pm2 logs clantrader --lines 5 --nostream`

Summarize:
- Lint result (errors/warnings count)
- Build result (success/fail)
- Tarball size
- Health check status code
- Any startup errors

If any step fails, stop and report the error. Do NOT continue to the next step.
