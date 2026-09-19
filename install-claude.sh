#!/usr/bin/env bash
#
# install-claude.sh — Install the Open Agency roster as Claude Code subagents.
#
# Usage:
#   ./install-claude.sh                 # install for all projects (~/.claude/agents)
#   ./install-claude.sh --project       # install into ./.claude/agents (this repo only)
#   ./install-claude.sh --dry-run       # show what would be copied, change nothing
#   ./install-claude.sh --list          # list agents that will be installed
#
# After installing, restart Claude Code and run `/agents` to see the roster,
# or just ask: "Use the Frontend Developer agent to build me a pricing page."

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="user"
DRY_RUN=0
LIST_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --project) MODE="project" ;;
    --dry-run) DRY_RUN=1 ;;
    --list)    LIST_ONLY=1 ;;
    -h|--help)
      sed -n '3,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1 ;;
  esac
done

if [ "$MODE" = "project" ]; then
  DEST_DIR="$PWD/.claude/agents"
else
  DEST_DIR="${HOME}/.claude/agents"
fi

# A valid Claude Code subagent is a markdown file whose YAML frontmatter
# carries both `name:` and `description:`.
is_agent() {
  local f="$1"
  [ "$(head -1 "$f")" = "---" ] || return 1
  local fm
  fm="$(sed -n '2,/^---$/p' "$f")"
  printf '%s\n' "$fm" | grep -q '^name:' || return 1
  printf '%s\n' "$fm" | grep -q '^description:' || return 1
  return 0
}

# Agent files live in <division>/<division>-<role>.md — flatten them into one
# directory so Claude Code picks every one up. Filenames are already unique
# because each is prefixed with its division.
AGENT_FILES=()
SKIPPED_FILES=()
while IFS= read -r f; do
  if is_agent "$f"; then
    AGENT_FILES+=("$f")
  else
    SKIPPED_FILES+=("$f")
  fi
done < <(
  find "$SRC_DIR" -mindepth 2 -maxdepth 2 -name '*.md' \
    -not -path "*/.git/*" -not -path "*/.claude/*" | sort
)

if [ "${#AGENT_FILES[@]}" -eq 0 ]; then
  echo "No agent files found under $SRC_DIR" >&2
  exit 1
fi

echo "Roster:  ${#AGENT_FILES[@]} agents"
echo "Target:  $DEST_DIR"
echo

for f in "${AGENT_FILES[@]}"; do
  printf '  install  %s\n' "$(basename "$f")"
done

if [ "${#SKIPPED_FILES[@]}" -gt 0 ]; then
  echo
  echo "Skipped (not subagents — no name:/description: frontmatter):"
  for f in "${SKIPPED_FILES[@]}"; do
    printf '  skip     %s\n' "${f#"$SRC_DIR"/}"
  done
fi

if [ "$LIST_ONLY" -eq 1 ]; then
  exit 0
fi

echo
if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run — nothing written."
  exit 0
fi

mkdir -p "$DEST_DIR"
cp "${AGENT_FILES[@]}" "$DEST_DIR/"   # overwrites same-named files, never deletes yours

echo
echo "Installed ${#AGENT_FILES[@]} agents into $DEST_DIR"
echo
echo "Next steps:"
echo "  1. Open Claude Code and run:  /agents"
echo "  2. Or just ask in plain English:"
echo "     \"Use the Backend Architect agent to design a multi-tenant API.\""
echo
echo "Strategy docs (playbooks / runbooks) are not subagents — read them"
echo "directly from strategy/ and paste the relevant one into your session."
