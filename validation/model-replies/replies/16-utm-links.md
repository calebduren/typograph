# Building trackable campaign links with UTM parameters

UTM parameters are the query-string tags that tell your analytics tool where a visit came from. They're simple, but consistency matters more than cleverness.

## The five parameters

| Parameter      | Meaning                 | Example         |
| -------------- | ----------------------- | --------------- |
| `utm_source`   | Where the link lives    | `newsletter`    |
| `utm_medium`   | The channel type        | `email`         |
| `utm_campaign` | The campaign name       | `spring_launch` |
| `utm_term`     | Paid keyword (optional) | `running_shoes` |
| `utm_content`  | Which link variant      | `header_cta`    |

Only the first three are required by most tools.

## An example

Start with your page:

https://example.com/pricing

Add the tags after a question mark, joined with ampersands:

https://example.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=spring_launch

If the page already has an anchor, the fragment must come last:

https://example.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=spring_launch#compare-plans

Getting the order wrong (`#compare-plans?utm_source=...`) puts the tags in the fragment, and analytics won't see them.

## Naming rules

1. Use lowercase only. `Email` and `email` show up as different mediums.
2. Use underscores or hyphens, never spaces. Spaces become `%20` and look messy in reports.
3. Keep a shared spreadsheet of allowed values and check new links against it.
4. Don't put personal data (emails, names) in a UTM tag. It ends up in server logs.

## Internal links

Never use UTMs on links within your own site. They overwrite the visitor's original source, so a person who arrived from search now looks like they came from your homepage banner.

## Sharing and shortening

Long URLs look untidy in email, so use a shortener you control, or a button rather than a raw link. If you want to double-check a link, paste it into your browser and look at the address bar for the tags after it loads.

## When it goes wrong

- **Missing source in reports:** a redirect may be stripping the query string. Test with a private window.
- **Duplicate campaigns:** check for case differences and trailing spaces.
- **Traffic labelled "direct":** usually a link in an app or a document that doesn't pass referrers. Tagging fixes it.

For a template, ask your analytics owner for their naming guide at analytics@example.com, or tell me your channels and I'll draft one.
