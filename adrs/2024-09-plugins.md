# ADR: Plugins

## Decision

Supporting external plugins (no recompilation) is a non-goal.
Plugins should be contributed in the main repository or stay in forks.

## Context

It is convenient to be able to author a plugin / distribute it / use it without full rebuild.

## Options

# Justification

- external plugins do not benefit from typescript, so they are fragile;
- they cause duplication of dependencies;
- they make the API more rigid and need more code (to provide hooks notably);
- they are not so useful in practice.
