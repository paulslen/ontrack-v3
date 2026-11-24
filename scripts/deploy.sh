#!/usr/bin/env bash
# Deploy the pushed branch to the self-hosted server (Docker) without losing data or keys.
#
# Usage:
#   scripts/deploy.sh             # deploy the current branch (committed + pushed) to the server
#   scripts/deploy.sh --rollback  # switch back to the image that ran before the last deploy
#
# What it does (on the server, over SSH):
#   1. fast-forward the server checkout to your local HEAD (commits are sent over SSH as a git
#      bundle, so the server needs no GitHub access)
#   2. back up the data directory to ~/tasktrove-backups/ (tar.gz, last 30 kept)
#   3. build a new image while the old container keeps serving
#   4. swap containers, reusing the same data mount, port and env file
#   5. verify health, env keys and task/label counts; on any failure restore the old container
#
# Overridable settings (environment variables):
DEPLOY_HOST="${DEPLOY_HOST:-paul@paullen.com}"
REMOTE_DIR="${REMOTE_DIR:-~/dev/ontrack-v3}"
DATA_DIR="${DATA_DIR:-/home/paul/data}"
ENV_FILE="${ENV_FILE:-~/tasktrove.env}"
BACKUP_DIR="${BACKUP_DIR:-~/tasktrove-backups}"
CONTAINER="${CONTAINER:-tasktrove}"
IMAGE="${IMAGE:-tasktrove-local}"
PORT="${PORT:-3000}"
REQUIRED_KEYS="${REQUIRED_KEYS:-AUTH_SECRET TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID CRON_SECRET}"
BUNDLE="~/.tasktrove-deploy.bundle"

set -euo pipefail

MODE="deploy"
if [[ "${1:-}" == "--rollback" ]]; then
  MODE="rollback"
elif [[ $# -gt 0 ]]; then
  echo "Unknown argument: $1" >&2
  exit 2
fi

# --- Local pre-checks: deploy exactly what is committed and pushed (keeps GitHub in sync) ---
if [[ "$MODE" == "deploy" ]]; then
  repo_root="$(git rev-parse --show-toplevel)"
  cd "$repo_root"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "✗ Uncommitted local changes. Commit and push before deploying." >&2
    exit 1
  fi
  git fetch --quiet origin
  branch="$(git branch --show-current)"
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch" 2>/dev/null || true)" ]]; then
    echo "✗ Local $branch differs from origin/$branch. Push (or pull) first." >&2
    exit 1
  fi
  target_sha="$(git rev-parse HEAD)"
  echo "→ Deploying $branch @ $(git rev-parse --short HEAD) to $DEPLOY_HOST"

  # Ship only the commits the server is missing
  server_sha="$(ssh -o BatchMode=yes "$DEPLOY_HOST" "git -C $REMOTE_DIR rev-parse HEAD")"
  if [[ "$server_sha" != "$target_sha" ]]; then
    range="$branch"
    if git cat-file -e "$server_sha^{commit}" 2>/dev/null; then
      range="$server_sha..$branch"
    fi
    local_bundle="$(mktemp)"
    git bundle create "$local_bundle" "$range" 2>/dev/null
    ssh -o BatchMode=yes "$DEPLOY_HOST" "cat > $BUNDLE" <"$local_bundle"
    rm -f "$local_bundle"
  fi
fi

ssh -o BatchMode=yes "$DEPLOY_HOST" \
  MODE="$MODE" REMOTE_DIR="$REMOTE_DIR" DATA_DIR="$DATA_DIR" ENV_FILE="$ENV_FILE" \
  BACKUP_DIR="$BACKUP_DIR" CONTAINER="$CONTAINER" IMAGE="$IMAGE" PORT="$PORT" \
  REQUIRED_KEYS="'$REQUIRED_KEYS'" EXPECTED_BRANCH="${branch:-}" EXPECTED_SHA="${target_sha:-}" \
  BUNDLE="$BUNDLE" \
  bash -s <<'REMOTE'
set -euo pipefail

say() { printf '→ %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# Counts used to prove no data was lost across the swap
data_counts() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    console.log(`tasks=${d.tasks.length} labels=${d.labels.length} projects=${d.projects.length}`);
  ' "$DATA_DIR/data.json"
}

# Hash of KEY=VALUE pairs, so the env file and the container can be compared without printing secrets
env_file_hash() { grep -v '^[[:space:]]*#' "$ENV_FILE" | grep '=' | sort | sha256sum | cut -d' ' -f1; }
container_env_hash() {
  docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -v -E '^(PATH|SSL_CERT_FILE|NODE_VERSION|YARN_VERSION)=' | grep . | sort | sha256sum | cut -d' ' -f1
}

run_container() {
  docker run -d --name "$CONTAINER" --restart unless-stopped \
    -p "$PORT:$PORT" \
    -v "$DATA_DIR:/app/data" \
    --env-file "$ENV_FILE" \
    "$1" >/dev/null
}

wait_healthy() {
  for _ in $(seq 1 60); do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/health")" == "200" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# --- Preconditions ---
[[ -f "$ENV_FILE" ]] || die "Env file $ENV_FILE not found"
for key in $REQUIRED_KEYS; do
  grep -q "^$key=." "$ENV_FILE" || die "Env file is missing a value for $key"
done
[[ -f "$DATA_DIR/data.json" ]] || die "No data.json in $DATA_DIR"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "Container $CONTAINER not found"

counts_before="$(data_counts)"
say "Data before: $counts_before"

# --- Pick the image to run ---
if [[ "$MODE" == "rollback" ]]; then
  docker image inspect "$IMAGE:previous" >/dev/null 2>&1 || die "No $IMAGE:previous image to roll back to"
  new_image="$IMAGE:previous"
else
  cd "$REMOTE_DIR"
  current_branch="$(git branch --show-current)"
  if [[ -n "$EXPECTED_BRANCH" && "$current_branch" != "$EXPECTED_BRANCH" ]]; then
    die "Server checkout is on $current_branch, but you are deploying $EXPECTED_BRANCH"
  fi
  # public/sw.js is regenerated by every build; drop local build output so the pull stays clean
  git checkout -- apps/web/public/sw.js 2>/dev/null || true
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "Server checkout has local changes: $(git status --short --untracked-files=no)"
  if [[ "$(git rev-parse HEAD)" != "$EXPECTED_SHA" ]]; then
    [[ -f "$BUNDLE" ]] || die "Server is not at $EXPECTED_SHA and no bundle was received"
    git fetch --quiet "$BUNDLE" "$EXPECTED_BRANCH"
    git merge --ff-only --quiet FETCH_HEAD || die "Server checkout can't fast-forward to $EXPECTED_SHA"
    git update-ref "refs/remotes/origin/$EXPECTED_BRANCH" "$EXPECTED_SHA"
  fi
  rm -f "$BUNDLE"
  [[ "$(git rev-parse HEAD)" == "$EXPECTED_SHA" ]] || die "Server checkout is not at $EXPECTED_SHA"
  sha="$(git rev-parse --short HEAD)"
  say "Server checkout at $sha ($(git log -1 --format=%s))"

  say "Building image $IMAGE:$sha (old container keeps serving)…"
  docker build -q -f apps/web/Dockerfile -t "$IMAGE:$sha" . >/dev/null
  new_image="$IMAGE:$sha"
fi

# --- Back up data before touching the running container ---
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz"
tar czf "$backup" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
# List first, then search: piping into `grep -q` can SIGPIPE tar and fail the check under pipefail
backup_listing="$(tar tzf "$backup")"
grep -q "data.json" <<<"$backup_listing" || die "Backup $backup does not contain data.json"
say "Backup: $backup ($(du -h "$backup" | cut -f1))"
ls -1t "$BACKUP_DIR"/data-*.tar.gz | tail -n +31 | xargs -r rm --

# --- Swap containers, keeping the old one ready for instant restore ---
old_image_id="$(docker inspect "$CONTAINER" --format '{{.Image}}')"
docker rm -f "$CONTAINER-old" >/dev/null 2>&1 || true
docker stop "$CONTAINER" >/dev/null
docker rename "$CONTAINER" "$CONTAINER-old"

restore_old() {
  printf '✗ %s — restoring the previous container\n' "$1" >&2
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker rename "$CONTAINER-old" "$CONTAINER"
  docker start "$CONTAINER" >/dev/null
  wait_healthy && echo "↺ Previous version is running again" >&2
  exit 1
}

run_container "$new_image" || restore_old "Failed to start $new_image"
wait_healthy || { docker logs --tail 40 "$CONTAINER" >&2 || true; restore_old "Health check failed"; }

# --- Verify keys and data ---
[[ "$(container_env_hash)" == "$(env_file_hash)" ]] || restore_old "Env keys in new container differ from $ENV_FILE"
counts_after="$(data_counts)"
[[ "$counts_after" == "$counts_before" ]] || restore_old "Data counts changed ($counts_before → $counts_after); backup at $backup"
say "Data after:  $counts_after ✓"
say "Env keys:    $(grep -v '^[[:space:]]*#' "$ENV_FILE" | grep '=' | sed 's/=.*//' | tr '\n' ' ')✓"

# --- Clean up: keep the old image as :previous for rollback, drop older builds ---
docker rm "$CONTAINER-old" >/dev/null
if [[ "$MODE" == "deploy" ]]; then
  docker tag "$old_image_id" "$IMAGE:previous"
  docker tag "$new_image" "$IMAGE:latest"
  docker images "$IMAGE" --format '{{.Tag}} {{.ID}}' | while read -r tag _; do
    case "$tag" in latest|previous|"${new_image#*:}") ;; *) docker rmi "$IMAGE:$tag" >/dev/null 2>&1 || true ;; esac
  done
  docker image prune -f >/dev/null
fi
say "Live on port $PORT: $new_image ✓"
REMOTE
