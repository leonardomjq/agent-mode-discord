#!/bin/bash
# Agent Mode Discord — companion plugin stop hook
# Removes lockfile to signal Claude Code session ended.
LOCKFILE="$HOME/.claude/agent-mode-discord.lock"
rm -f "$LOCKFILE"
