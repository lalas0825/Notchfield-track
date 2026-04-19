# PowerSync sync-rules validator — bucket parameter rules

The validator has 3 strict rules that are easy to trip when designing
global/shared-data buckets. Recording them here because we hit all three
in sequence during Sprint TOOLBOX.

## Rule 1 — Every bucket parameter must appear in every data query's WHERE

```yaml
# REJECTED
my_bucket:
  parameters:
    - SELECT id AS user_id FROM profiles WHERE id = token_parameters.user_id
  data:
    - SELECT * FROM shared_table WHERE active = true
#       Error: Query must cover all bucket parameters.
#              Expected: ["bucket.user_id"] Got: []
```

## Rule 2 — `=` cannot have bucket parameters on BOTH sides

```yaml
# REJECTED — attempted tautology
data:
  - SELECT * FROM shared_table WHERE bucket.user_id = bucket.user_id
#       Error: Cannot have bucket parameters on both sides of = operator
```

## Rule 3 — OR branches must reference the same bucket parameters

```yaml
# REJECTED — left branch uses bucket.org_id, right uses none
data:
  - SELECT * FROM toolbox_library
    WHERE (organization_id = bucket.organization_id OR organization_id IS NULL)
      AND active = true
#       Error: Left and right sides of OR must use the same parameters,
#              or split into separate queries.
#              [{"key":"bucket.organization_id","expands":false}] != []
```

And splitting into two separate data queries fails Rule 1 on the second
query (no bucket.organization_id reference).

## Working pattern for global/shared data

Use a dedicated bucket with a CONSTANT-marker parameter. A comparison
between a constant and a bucket param is legal (Rule 2 only bans
param-to-param):

```yaml
toolbox_global:
  parameters:
    - SELECT 1 AS marker FROM profiles WHERE id = token_parameters.user_id
  data:
    - SELECT * FROM toolbox_library
      WHERE organization_id IS NULL
        AND active = true
        AND bucket.marker = 1
```

Every authenticated user emits one bucket instance with `marker=1`, so
everyone syncs the same global rows.

The parameter query MUST still authenticate via `token_parameters.user_id`
(otherwise unauthenticated users would get data). The `SELECT 1 AS marker
FROM profiles WHERE id = token_parameters.user_id` shape gates access
correctly — a user only gets the bucket if their profile exists.

## Accepted comparison forms with bucket params

| Form | Status |
|---|---|
| `col = bucket.param` | ✅ |
| `bucket.param = col` | ✅ |
| `const = bucket.param` | ✅ |
| `bucket.param = const` | ✅ |
| `bucket.paramA = bucket.paramB` | ❌ |
| `bucket.param IS NOT NULL` | ⚠ untested — avoid |
