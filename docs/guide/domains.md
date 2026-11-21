# Tenant business domains

One console serves many businesses, each reachable at its own hostname. On a
business domain the console opens the **tenant portal**; on the console's own
host it opens the system portal.

Certificates are issued automatically, on a hostname's first visit, and only
for hostnames the API confirms it serves.

## Adding a domain

1. **DNS** — point an `A` record for the hostname at this server.
2. **Console** — System → Business Domains → **Add Domain**, pick the
   business, enter the hostname.
3. **Open it** — the first HTTPS visit obtains a certificate, which takes a
   few seconds. Renewal is automatic.

No restart is needed. The domain list is cached for 15 seconds and the cache
is dropped the moment you save, so the edge can get a certificate on the very
next request.

The hostname is normalized on the way in: `HTTPS://Acme.Example.com:3000/x`
is stored as `acme.example.com`. A hostname already used by another business
is refused, and so is one reserved for the system console — otherwise an
admin could point the console's own domain at a tenant portal and lock
themselves out.

::: tip Testing locally needs no DNS
`localhost` and every `*.localhost` name resolve to this machine in Chrome,
Edge and Firefox. Add `acme.localhost` to a business and open
`https://acme.localhost` — Caddy signs it with its own CA, so you will see one
certificate warning and nothing else to set up.
:::

## How a certificate is issued

The edge never holds a list of domains. It **asks**, per hostname, at the
first TLS handshake:

```
browser ──TLS──▶ edge (Caddy) ──▶ GET /api/v1/public/site/allowed?domain=<host>&key=…
                                   200 {"allowed":true}  → issue
                                   404                   → refuse
```

A refusal is what the browser reports as `ERR_SSL_PROTOCOL_ERROR`, with
nothing else to go on — so the API **logs every refusal** and says what to do
about it:

```
No certificate for "evil.example.com": it is not an enabled business domain,
and SYSTEM_PORTAL_HOSTS is empty. Add it under Tenant Business Domains, or
name it in SYSTEM_PORTAL_HOSTS in backend/.env and recreate the API.
```

Check it directly when a hostname will not take a certificate:

```bash
docker compose exec edge wget -qO- \
  'http://fttddwa-api:4000/api/v1/public/site/allowed?domain=app.example.com&key=<EDGE_ASK_KEY>'
```

### Why that endpoint is unauthenticated

Caddy's `on_demand_tls ask` issues a bare GET: it cannot carry a session, and
it cannot set headers — which is also why the route is the one place exempt
from the otherwise mandatory `x-device-type`. It is defended four ways
instead:

- The console gateway hard-`404`s the path, so no browser can reach it.
- The API publishes no host port at all.
- The edge passes `EDGE_ASK_KEY`, compared in constant time.
- The route is throttled to 30 requests a minute.

A source-IP check would not work: the edge reaches the API over the app
network, where its address is assigned by Docker, so its fixed address on the
proxy network is not what the API sees.

## The very first domain

On a new server there are no business domains yet — so **no hostname can get
a certificate, including the console you would use to add the first one**.

`SYSTEM_PORTAL_HOSTS` in `backend/.env` is the way out. It lists the system
console's own hostnames, comma separated, with no port:

```bash
SYSTEM_PORTAL_HOSTS=admin.example.com
ACME_EMAIL=you@example.com
COOKIE_SECURE=true
```

It is read once when the API starts, so it needs a **recreate, not a
restart**:

```bash
docker compose up -d --force-recreate api
```

The API warns at startup when this is empty *and* no business domain exists,
because otherwise the failure is undebuggable.

Leaving it empty is fine locally: every host is then treated as the console,
which is the development default. It never means "any hostname gets a
certificate".

## What a request looks like

```
browser ──https──▶ edge (Caddy :443) ──▶ console gateway ──▶ console (Next.js)
                                              └── /api, /uploads ──▶ api
```

The browser only ever talks to the hostname it is already on. The console is
configured with a relative `APP_API_URL=/api/v1`, so every API call is
same-origin — which is why **adding a domain needs no CORS change**, and why
each domain gets its own cookie jar rather than sharing one with the console.

The business identity travels in the `Host` header, which nginx preserves. No
per-tenant routing exists in the edge, and no business id is injected
anywhere: the API resolves it from the host.

## Disabling versus removing

**Disable** keeps the record and stops the hostname resolving to its business;
its certificate is simply not renewed. **Remove** deletes the row outright —
deliberately, and unlike every other record in this system, which is
soft-deleted. A soft-deleted row would keep holding the unique hostname and
block a legitimate re-claim later.

## Why only system admins manage these

Every other tenant-scoped resource has a tenant self-service twin. Domains do
not, on purpose: claiming a hostname is a trust boundary. A tenant could
otherwise assert ownership of a name they do not control and have the edge
request a public certificate for it.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `ERR_SSL_PROTOCOL_ERROR` | The API refused the certificate. Check `docker compose logs api` for the refusal line — it names the reason. |
| Refused on a hostname you just added | Disabled, or its business is inactive or deleted. The lookup requires both. |
| Works on `http://` but not `https://` | Ports 80 **and** 443 must be reachable; Let's Encrypt validates over HTTP-01 on port 80, so 443 alone is not enough. |
| The certificate is from Caddy, not Let's Encrypt | `EDGE_TLS=local_certs` is set in `backend/.env`. Leave it empty for public domains. |
| A domain works but shows the system login | The hostname is in `SYSTEM_PORTAL_HOSTS`, which wins over the business lookup. |

::: danger Never `docker compose down -v` once real certificates exist
It deletes the `fttddwa-caddy-data` volume, and the next start re-requests every
certificate — straight into Let's Encrypt's rate limit of 5 per domain per
week.
:::
