# Handling quotes and commas in CSV files

CSV looks simple until a field contains a comma, a newline, or a quote. The rules are short, though, and they're defined in RFC 4180.

## The three rules

1. If a field contains a comma, a line break, or a double quote, wrap it in double quotes.
2. Inside a quoted field, represent each literal double quote as two double quotes.
3. Otherwise, don't quote it. Quoting everything is legal but unnecessary.

## Examples

| Value           | In the CSV          |
| --------------- | ------------------- |
| `Smith, John`   | `"Smith, John"`     |
| `She said "hi"` | `"She said ""hi"""` |
| `O'Brien`       | `O'Brien`           |
| `5'11"`         | `"5'11"""`          |

Notice that a single quote (apostrophe) never needs special treatment. Only the double quote is special in CSV.

## A worked line

Here is a row with four fields: a name, a height, a note, and a city.

```csv
name,height,note,city
"O'Brien, Pat","5'11""","Said, ""I'll be there""",Dublin
```

When parsed, the second field is `5'11"`, and the third is `Said, "I'll be there"`.

## Use a library

Don't write your own splitter. This fails on the first quoted comma:

```python
line.split(",")  # wrong for quoted fields
```

Use the standard library instead:

```python
import csv

with open("people.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        print(row["name"], row["height"])
```

The `newline=""` argument matters, because it lets the parser handle line breaks inside quoted fields.

## Spreadsheet pitfalls

- Excel may reinterpret values like `1-2` or `00123` as dates or numbers. Import through the Data menu and set columns to Text.
- Curly quotes in a cell aren't the same as the straight quote character, so a parser won't treat them as delimiters, and they'll survive as ordinary text.
- Save as UTF-8 so names with accents come through unchanged.

## When CSV isn't enough

If your data has nested structure or many multi-line text fields, consider JSON Lines or Parquet. CSV is best for flat tables that people will open in a spreadsheet.

Paste a sample of the file and I'll tell you where the escaping goes wrong.
