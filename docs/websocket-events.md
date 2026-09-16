# KDS WebSocket Contract

## Connection

```
wss://{ws-host}/ws?company_id={companyId}&token={accessToken}
```

- One connection per company scope — the frontend opens exactly one socket after config is saved and the board mounts, and closes it on scope change / logout.
- `token` is the same JWT access token used for REST calls. The gateway validates it the same way the REST API does (short expiry — the frontend reconnects with a fresh token after a silent refresh, so the gateway does not need its own refresh flow).
- If the token is invalid/expired at connect time, the gateway closes with code `4401`. The frontend treats `4401` as "refresh and retry once", not as a generic reconnect.

## Server → client events

Every message is JSON with a `type` and `data`. `data` is always the same
**OrderLineCard** shape the REST API uses (see `openapi.yaml`) — kitchen
state lives on the order line, so events are per-line, not per-order:

```json
{ "type": "order_line.updated", "data": { "id": "l4", "order_id": "so3", "order_name": "SO0229", "table_number": "12", "product_name": "Chicken Satay", "qty": 3, "kitchen_state": "cooking", "created_at": "...", "updated_at": "..." } }
```

| type                | data                     | when                                                                 |
|----------------------|--------------------------|-----------------------------------------------------------------------|
| `order_line.created`  | `OrderLineCard`          | a new order line enters the selected company scope                    |
| `order_line.updated`  | `OrderLineCard`          | `kitchen_state` or any displayed field changes (from KDS drag, POS, or Odoo backend) |
| `order_line.removed`  | `{ "id": string }`       | a line leaves the scope (order cancelled, or line removed)            |
| `ping`                | `{ "ts": number }`       | heartbeat, every 25s; client does not need to reply                   |

No client → server event types are required for v1. The frontend only needs to open/close the connection; all mutations still go through the REST `PATCH /order-lines/{id}/state` call so there is one source of truth and one place authorization is enforced.

## Reconnection contract (frontend behavior, documented so the gateway's expectations match)

- Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s, ±20% jitter.
- After 3 consecutive failed attempts, the UI switches to "polling" mode: `GET /order-lines?...&since=<last_known_updated_at>` every 5s, and keeps retrying the socket in the background.
- On reconnect, the frontend calls `GET /order-lines?...&since=<last_known_updated_at>` once to reconcile anything missed while disconnected, then resumes trusting the socket.

## Versioning

If event shapes change incompatibly, bump the path to `/ws/v2`. Additive fields (new optional keys on `OrderLineCard`) do not require a version bump.
