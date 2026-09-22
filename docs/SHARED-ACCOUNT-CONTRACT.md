# Shared YasReady account contract

## Rule

Marketplace does not create or own another login for an author.

The account that created the book in Publishing is the account that owns the book in Marketplace.

## Canonical key

`authors.user_id` stores the central YasReady identity subject (`sub`). A unique index prevents one central account from silently becoming multiple Marketplace author records.

## Production auth mode

Set:

- `YASREADY_AUTH_MODE=oidc`
- `YASREADY_AUTH_ISSUER`
- `YASREADY_AUTH_AUDIENCE`
- `YASREADY_JWKS_URL`

`src/lib/auth.mjs` verifies RS256 JWT signatures against the configured JWKS endpoint and validates issuer, audience and token time claims.

The Marketplace Worker then:

1. validates the central token;
2. reads the stable `sub` as the YasReady user ID;
3. finds `authors.user_id = sub`;
4. creates a Marketplace author profile on first visit if one does not yet exist;
5. never asks the author to create another password.

## Local/private-beta mode

`YASREADY_AUTH_MODE=demo` supplies a seeded YasReady identity so the complete author workspace can be demonstrated before the shared production identity provider is wired.

## Publishing handoff

A future Publishing payload should include the same stable central `userId`. Marketplace uses that ID to attach the completed title to the correct author account.

Publishing must not send passwords, session cookies or Marketplace-specific credentials.


## Browser identity adapter

The UI does not store credentials. `src/lib/session-client.js` looks for a central account SDK exposed as:

```js
window.YasReadyIdentity.getAccessToken()
```

That function should return the same short-lived access token used by the rest of YasReady. Until the central account SDK is attached, demo mode works without it.
