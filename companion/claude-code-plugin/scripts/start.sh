#!/bin/bash
# Agent Mode Discord — companion plugin start hook
# Writes lockfile to signal active Claude Code session to the VS Code extension.
set -euo pipefail

LOCKFILE="${HOME:?HOME is not set}/.claude/agent-mode-discord.lock"
mkdir -p "$(dirname "$LOCKFILE")"
touch "$LOCKFILE"
