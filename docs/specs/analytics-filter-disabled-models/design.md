# Analytics: Hide Disabled Models in Per-Model Breakdown — Design

## Architecture Decision: Convert LEFT JOIN to INNER JOIN + NULL Guard

The `/by-model` endpoint already has a `LEFT JOIN models m ON m.platform = r.platform AND m.model_id = r.model_id`. The shortest correct change is to add a WHERE condition that excludes rows where `m.enabled = 0`.

However, naïvely adding `AND m.enabled = 1` to the WHERE clause would also exclude **untracked models** (no `models` row → `m.enabled IS NULL`) because `NULL = 1` is falsy. Per FR-6, untracked models must remain visible.

### Chosen approach: NULL-safe WHERE condition

Add a single WHERE filter:

```sql
AND (m.enabled IS NULL OR m.enabled = 1)
```

This keeps the existing `LEFT JOIN` (needed for `display_name` and pricing columns) and cleanly handles all three cases:

| `m.enabled` value | Meaning | Included? |
|---|---|---|
| `1` | Model enabled | ✅ Yes |
| `0` | Model disabled | ❌ No |
| `NULL` | No models row (untracked) | ✅ Yes (FR-6) |

### Why not INNER JOIN?

Converting to `INNER JOIN … AND m.enabled = 1` would break FR-6 (untracked models excluded) and lose `display_name` fallback for custom models. The NULL-safe WHERE clause is strictly additive and less risky.

## Current SQL (simplified)

```sql
SELECT
  r.platform,
  r.model_id,
  m.display_name,
  COUNT(*) as requests,
  ...
FROM requests r
LEFT JOIN models m ON m.platform = r.platform AND m.model_id = r.model_id
WHERE r.created_at >= ?
  AND r.platform IN (SELECT platform FROM active_platforms)
GROUP BY r.platform, r.model_id
ORDER BY requests DESC
```

## New SQL

```sql
SELECT
  r.platform,
  r.model_id,
  m.display_name,
  COUNT(*) as requests,
  ...
FROM requests r
LEFT JOIN models m ON m.platform = r.platform AND m.model_id = r.model_id
WHERE r.created_at >= ?
  AND r.platform IN (SELECT platform FROM active_platforms)
  AND (m.enabled IS NULL OR m.enabled = 1)
GROUP BY r.platform, r.model_id
ORDER BY requests DESC
```

The only addition is one line: `AND (m.enabled IS NULL OR m.enabled = 1)`.

## Files Changed

| File | Change |
|---|---|
| `server/src/routes/analytics.ts` | Add `AND (m.enabled IS NULL OR m.enabled = 1)` to `/by-model` query |
| `server/src/__tests__/routes/analytics.test.ts` | Add `describe('disabled model filtering in by-model')` test block with 4+ new tests |

No other files change. No client changes. No schema changes.

## Interaction with Existing Spec (analytics-filter)

This spec extends `analytics-filter`. The platform-level filter (`active_platforms` CTE + IN clause) remains unchanged. The model-level `enabled` check is applied **after** the platform filter, as an additional WHERE condition in the same query. The two filters compose naturally with AND.

## Rollback

A single-line removal from the SQL WHERE clause. No migration, no client change to undo.
