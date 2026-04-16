#!/bin/bash
# Agent Mode Discord — companion plugin stop hook
# Removes lockfile to signal Claude Code session ended.
set -euo pipefail

LOCKFILE="${HOME:?HOME is not set}/.claude/agent-mode-discord.lock"
rm -f "$LOCKFILE"
