# ClanTrader Iran VPS — Claude Code Rules

## Environment

This is the **STAGING + PRODUCTION** server (Iran VPS: `37.32.10.153`).
- **Staging**: `/home/ubuntu/clantrader-staging` (port 3001, `staging.clantrader.ir`)
- **Production**: `/home/ubuntu/clantrader` (port 3000, `clantrader.ir`)
- You are running in the **STAGING** directory
- Redis: staging uses DB 1, production uses DB 0
- PostgreSQL: staging uses `clantrader_staging`, production uses `clantrader_prod`

## Critical Restrictions

### NEVER touch production
- NEVER modify files in `/home/ubuntu/clantrader/`
- NEVER restart the `clantrader` PM2 process
- NEVER modify production `.env` or production database
- To promote staging to production, tell the user to run: `scripts/promote-to-prod.sh`

### NEVER run internet-dependent commands
- NEVER run: `npm install`, `npm update`, `npx create-*`, `git clone`, `git pull`, `git push`, `git fetch`
- NEVER run: `curl`/`wget` to external URLs (except `localhost` health checks)
- NEVER run: `pip install`, `apt install`, or any package manager
- All dependencies are pre-built in the tarball from the US VPS

### NEVER run build commands
- NEVER run: `npm run build`, `npx prisma generate`, `npx next build`
- The `.next/` build output comes pre-built from the US VPS
- If a rebuild is needed, it must be done on the US VPS and redeployed

### What you CAN do
- Edit files in `/home/ubuntu/clantrader-staging/src/` (for hotfixes only)
- Read files anywhere for debugging
- Check PM2 logs: `pm2 logs clantrader-staging`
- Restart staging: `pm2 restart clantrader-staging`
- Run `npx prisma db push` in staging dir (for schema sync)
- Run health checks: `curl http://localhost:3001`
- View nginx logs: `tail /var/log/nginx/*.log`
- Check Redis: `redis-cli -n 1` (staging uses DB 1)
- Check PostgreSQL: `psql clantrader_staging`

## SSH Tunnel for Claude Code

To use Claude Code on this server, first establish an SSH tunnel from Iran VPS to US VPS:

```bash
ssh -D 1080 -N -f root@31.97.211.86
```

Then run Claude Code with the proxy:

```bash
ALL_PROXY=socks5://127.0.0.1:1080 claude
```

To check if the tunnel is still active:

```bash
curl -x socks5://127.0.0.1:1080 -s https://api.anthropic.com > /dev/null && echo "Tunnel OK" || echo "Tunnel DOWN"
```

## Debugging Checklist

1. `pm2 status` — check if processes are running
2. `pm2 logs clantrader-staging --lines 50` — check recent errors
3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001` — staging health
4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` — production health
5. `redis-cli -n 1 ping` — staging Redis connectivity
6. `psql clantrader_staging -c "SELECT 1"` — staging DB connectivity
7. `nginx -t` — check nginx config syntax
8. `tail -20 /var/log/nginx/error.log` — recent nginx errors

## Deployment Flow

```
US VPS (dev) ──deploy-pack.sh──> deploy.tar.gz
                                      │
                         scp (via laptop)
                                      │
Iran VPS ──deploy-staging.sh──> staging (port 3001)
                                      │
                         test from Iranian IP
                                      │
         ──promote-to-prod.sh──> production (port 3000)
```
