---
name: deploy
description: Deploy the current branch to the self-hosted TaskTrove server (paul@paullen.com, Docker) safely — backs up data, keeps env keys, auto-restores on failure. Use when the user asks to deploy, ship, release, push to the server, or roll back.
---

# Deploy TaskTrove to the home server

The server runs the app as the Docker container `tasktrove` (image `tasktrove-local`) built from
the checkout `~/dev/ontrack-v3` on `paul@paullen.com`.

- Data: `/home/paul/data` (bind-mounted to `/app/data`) — `data.json`, `assistant-chat.json`
- Keys: `~/tasktrove.env` (`AUTH_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`)
- Backups made by deploys: `~/tasktrove-backups/data-<timestamp>.tar.gz` (last 30 kept)

Everything is done by `scripts/deploy.sh`. Never hand-run `docker rm`/`docker run` on the server
instead of the script, and never print the env file's values.

## Steps

1. **Pre-flight (local):**
   - `git status` must be clean and the branch pushed (the script refuses otherwise). If not,
     tell the user what is uncommitted/unpushed and stop — the user commits and pushes themselves.
   - Run `pnpm run typecheck` (Node 22 for tests: `PATH=$HOME/.nvm/versions/node/v22.22.2/bin:$PATH`).
     Report failures and ask before deploying anyway.
2. **Confirm** with the user that they want to deploy `<branch>@<short sha>` now (it restarts the
   live app for ~10 seconds).
3. **Deploy:** `scripts/deploy.sh` (run with a long timeout, ~10 minutes; the Docker build is the
   slow part). The script:
   - sends the missing commits to the server as a git bundle over SSH (the server has no GitHub
     access in scripts) and fast-forwards its checkout, then builds the new image while the old
     container keeps serving,
   - backs up the data directory,
   - swaps containers with the same port, data mount and `--env-file`,
   - verifies `/api/health`, that the container's env matches the env file (hash compare), and that
     task/label/project counts are unchanged,
   - on any failure restores the previous container automatically.
4. **Report** in a few lines: deployed sha, backup file, data counts, health. If it failed, quote
   the `✗` line and what the script restored.

## Rollback

`scripts/deploy.sh --rollback` switches back to the image that ran before the last deploy
(`tasktrove-local:previous`), with the same backup and verification steps. Confirm with the user
first.

## Restoring data from a backup (only if the user asks)

On the server: stop the container, extract the chosen `~/tasktrove-backups/data-*.tar.gz` over
`/home/paul/data` (it contains the `data/` directory; files are root-owned, so this needs `sudo`,
which requires the user's password — give them the exact commands to run), then start the
container. Always make a fresh backup of the current data first.
