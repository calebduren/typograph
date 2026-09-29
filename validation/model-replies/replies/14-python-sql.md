# Safely putting quotes and apostrophes into SQL from Python

If you've ever had a query fail on a name like O'Connor, you've met the problem. The fix isn't to escape the apostrophe yourself. It's to stop building SQL out of strings.

## The broken way

```python
name = "O'Connor"
query = f"SELECT * FROM users WHERE last_name = '{name}'"
cursor.execute(query)
```

That produces `WHERE last_name = 'O'Connor'`, which is a syntax error, and worse, it's how SQL injection works. Anyone who submits `'; DROP TABLE users; --` as a last name is now writing your queries.

## The right way

Use parameters and let the driver handle quoting:

```python
name = "O'Connor"
cursor.execute("SELECT * FROM users WHERE last_name = %s", (name,))
```

For SQLite, the placeholder is `?`; for psycopg2 and MySQL drivers it's usually `%s`. The database receives the query and the values separately, so nothing in the value can change the query's structure.

## Multiple values

```python
rows = [("O'Brien", 34), ("D'Angelo", 29), ("Smith", 41)]
cursor.executemany(
    "INSERT INTO users (last_name, age) VALUES (%s, %s)",
    rows,
)
```

## What parameters can't do

Parameters work for values, not identifiers. You can't parameterize a table or column name. If those come from user input, validate them against an allowlist:

```python
ALLOWED_SORT = {"name", "created_at"}
if sort not in ALLOWED_SORT:
    raise ValueError(f"Can't sort by {sort!r}")
```

## Other quote traps

- **CSV export:** double any `"` inside a field, and wrap the field in quotes. Use the `csv` module rather than joining strings.
- **JSON columns:** use `json.dumps()` to serialize, not string formatting.
- **Shell commands:** use `subprocess.run([...])` with a list, not a single string, so no shell has to parse quotes.

## A checklist

1. Never use `f"..."` or `%` formatting to put values into SQL.
2. Use your driver's placeholders every time.
3. Allowlist anything that isn't a value.
4. Test with names like O'Brien and "Bobby" Tables.

If you tell me which database and driver you're using, I'll show the exact placeholder style.
