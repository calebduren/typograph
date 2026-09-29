# Designing error responses for a JSON API

A good error response tells the caller what went wrong, whether retrying will help, and where to look for more detail. The rest is convention.

## Use the right status code

- **400** for a malformed request.
- **401** when the caller isn't authenticated.
- **403** when they're authenticated but not permitted.
- **404** when the resource doesn't exist.
- **409** for a conflict, such as a duplicate.
- **422** for a well-formed request with invalid values.
- **429** when the caller is rate limited.
- **500** for a server bug, and **503** for temporary unavailability.

## A consistent shape

Pick one structure and use it everywhere. Something like RFC 9457, "Problem Details for HTTP APIs," works well:

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Your request parameters didn't validate.",
  "status": 422,
  "detail": "The field \"email\" must be a valid address.",
  "errors": [{ "field": "email", "message": "Must contain an '@' symbol" }],
  "request_id": "req_8f2c1a"
}
```

Set the `Content-Type` to `application/problem+json` if you follow that standard.

## Writing the messages

1. **Be specific.** "Invalid input" is useless; "The field 'age' must be between 0 and 120" is actionable.
2. **Don't leak internals.** Stack traces, SQL, and file paths help attackers, not users.
3. **Keep machine-readable codes stable.** Callers write `if (error.code === "email_taken")`, so renaming codes breaks clients. Messages, by contrast, can change.
4. **Include a request ID** that support can search for in the logs.

## Quotes inside JSON messages

If a message includes a quotation mark, it must be escaped as `\"`, as in the `detail` above. Build the response with your framework's serializer rather than string concatenation, so you never have to think about it.

## Retry guidance

For 429 and 503, include a `Retry-After` header. For 4xx errors, make it clear that retrying won't help unless the caller changes the request.

## Testing

Write a test that hits every error path and checks the status code, the content type, and the presence of `request_id`. It sounds pedantic until the first time a client's parser chokes on an HTML error page from a proxy.

If you tell me which framework you're using, I can show you a small middleware that handles all of this in one place.
