# foom_attendance: CORS for the KDS browser app

KDS (https://kds-fnb.vercel.app) calls `POST /foom/attendance/api/login` and `/shifts` straight from the browser. These are cross-origin calls with `Content-Type: application/json`, so the browser first sends an `OPTIONS` preflight. foom_fnb_api (`/api/kds/*`) already answers with `Access-Control-Allow-Origin: *`; foom_attendance is a separate module and does not, so the browser blocks the request. DevTools shows `login` twice with no status; that is the preflight failing.

## Option A (recommended): in the foom_attendance controllers

Add `cors` to every route under `/foom/attendance/api/*` (at least `login` and `shifts`), and list `OPTIONS` so the preflight matches:

```python
@http.route('/foom/attendance/api/login', type='http', auth='public',
            methods=['POST', 'OPTIONS'], csrf=False, cors='*')
def api_login(self, **kw): ...

@http.route('/foom/attendance/api/shifts', type='http', auth='public',
            methods=['POST', 'OPTIONS'], csrf=False, cors='*')
def api_shifts(self, **kw): ...
```

Notes:
- Odoo 18 adds `Access-Control-Allow-Origin` from `cors=` and answers the preflight, including `Access-Control-Allow-Headers` with Content-Type. If the routes are `type='json'`, use the same `cors=` argument.
- Safer than `*`: `cors='https://kds-fnb.vercel.app'` (one origin per route; use `*` if several KDS deployments exist).
- Token travels in the body, not in cookies or headers, so `*` is acceptable here. Do not add `Allow-Credentials`.

## Option B: reverse proxy (nginx / Cloudflare)

```nginx
location /foom/attendance/api/ {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin  "https://kds-fnb.vercel.app" always;
        add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
        add_header Access-Control-Max-Age 86400 always;
        return 204;
    }
    add_header Access-Control-Allow-Origin "https://kds-fnb.vercel.app" always;
    proxy_pass http://odoo;   # existing upstream
}
```
Do not use both A and B: duplicate `Access-Control-Allow-Origin` headers are rejected by browsers.

## Verify

```bash
curl -i -X OPTIONS https://odoo18-staging.foomid.id/foom/attendance/api/login \
  -H 'Origin: https://kds-fnb.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```
Expect `204`/`200` with `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers: ...Content-Type...`.

## No backend access? Same-origin proxy through Vercel

In the KDS project, add before the SPA catch-all in `vercel.json`:
```json
{ "source": "/foom/attendance/api/:path*", "destination": "https://odoo18-staging.foomid.id/foom/attendance/api/:path*" }
```
and set `VITE_ATTENDANCE_API_URL=/foom/attendance/api` in that Vercel project. One host per deployment, so it only suits a deployment that targets one Odoo.
