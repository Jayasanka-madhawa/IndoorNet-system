# Manual API Tests (curl)

Same coverage as `backend/tests/test_api.py` — run these by hand against a live server.

---

## Before you start

**Terminal 1 — start server:**

```bash
cd backend
source .venv/bin/activate
python -m app.seed          # fresh demo data
python run.py
```

**Terminal 2 — run curl commands:**

```bash
export BASE=http://127.0.0.1:5000
```

**Demo accounts (after seed):**

| Role   | Email          | Password   |
|--------|----------------|------------|
| Player | player@nets.lk | player123  |
| Owner  | owner@nets.lk  | owner123   |

**Save tokens** (run after login, paste token from response):

```bash
export PLAYER_TOKEN="paste-player-token-here"
export OWNER_TOKEN="paste-owner-token-here"
```

---

## 1. Health

### 1.1 Health check OK

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/health
```

**Expected:** `200`  
**Body:** `{"ok":true}`

---

## 2. Auth

### 2.1 Login player

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player@nets.lk","password":"player123"}'
```

**Expected:** `200`  
**Body includes:** `"token"`, `"email":"player@nets.lk"`, `"role":"player"`

Save token:

```bash
export PLAYER_TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player@nets.lk","password":"player123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo $PLAYER_TOKEN
```

---

### 2.2 Login owner

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@nets.lk","password":"owner123"}'
```

**Expected:** `200`  
**Body includes:** `"role":"owner"`

Save token:

```bash
export OWNER_TOKEN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@nets.lk","password":"owner123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo $OWNER_TOKEN
```

---

### 2.3 Login wrong password

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player@nets.lk","password":"wrong"}'
```

**Expected:** `401`  
**Body:** `{"error":"Invalid email or password"}`

---

### 2.4 Login missing fields

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"player@nets.lk"}'
```

**Expected:** `400`

---

### 2.5 Register new user

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@test.lk",
    "password": "pass123",
    "fullName": "New User",
    "role": "player"
  }'
```

**Expected:** `201`  
**Body includes:** `"token"`, `"email":"new@test.lk"`

---

### 2.6 Register duplicate email

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@nets.lk",
    "password": "pass123",
    "fullName": "Duplicate"
  }'
```

**Expected:** `409`

---

### 2.7 Register missing fields

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"incomplete@test.lk"}'
```

**Expected:** `400`

---

### 2.8 Get current user (with token)

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/auth/me \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

**Expected:** `200`  
**Body includes:** `"email":"player@nets.lk"`

---

### 2.9 Get current user (no token)

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/auth/me
```

**Expected:** `401`

---

## 3. Venues

### 3.1 List all venues

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/venues
```

**Expected:** `200`  
**Body:** array with 1 venue, name `"Colombo Indoor Nets"`

---

### 3.2 Get venue with bays

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/venues/1
```

**Expected:** `200`  
**Body includes:** `"bays"` array with 3 items, `"hourlyRateLkr":2000`

---

### 3.3 Venue not found

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/venues/999
```

**Expected:** `404`

---

### 3.4 Owner — my venues

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/venues/mine \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

**Expected:** `200`  
**Body:** array with 1 venue, includes `"bays"` (3 items)

---

### 3.5 Player cannot access my venues

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/venues/mine \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

**Expected:** `403`

---

## 4. Bookings

Use these time slots (same as automated tests):

```bash
export SLOT="2026-06-01T17:00:00"
export SLOT_END="2026-06-01T18:00:00"
export SLOT_2="2026-06-02T17:00:00"
export SLOT_2_END="2026-06-02T18:00:00"
```

> **Tip:** Re-run `python -m app.seed` if you want a clean DB before booking tests.

---

### 4.1 Availability — free slot

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  "$BASE/api/bookings/availability?bay_id=1&starts_at=$SLOT&ends_at=$SLOT_END"
```

**Expected:** `200`  
**Body:** `{"available":true,"bayId":1}`

---

### 4.2 Availability — missing params

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/bookings/availability
```

**Expected:** `400`

---

### 4.3 Availability — invalid times (end before start)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  "$BASE/api/bookings/availability?bay_id=1&starts_at=$SLOT_END&ends_at=$SLOT"
```

**Expected:** `400`

---

### 4.4 Create booking

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -d "{\"bayId\":1,\"startsAt\":\"$SLOT\",\"endsAt\":\"$SLOT_END\"}"
```

**Expected:** `201`  
**Body includes:** `"bayId":1`, `"status":"confirmed"`

---

### 4.5 Create booking — conflict (same slot twice)

Run the same command as **4.4** again immediately.

**Expected:** `409`  
**Body:** `{"error":"Slot not available"}`

---

### 4.6 Availability — after booking (slot taken)

First create a booking on slot 2:

```bash
curl -s -X POST $BASE/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -d "{\"bayId\":1,\"startsAt\":\"$SLOT_2\",\"endsAt\":\"$SLOT_2_END\"}"
```

Then check availability:

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  "$BASE/api/bookings/availability?bay_id=1&starts_at=$SLOT_2&ends_at=$SLOT_2_END"
```

**Expected:** `200`  
**Body:** `{"available":false,"bayId":1}`

---

### 4.7 My bookings

Create a booking on bay 2 first (use a fresh slot if needed):

```bash
curl -s -X POST $BASE/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLAYER_TOKEN" \
  -d "{\"bayId\":2,\"startsAt\":\"$SLOT\",\"endsAt\":\"$SLOT_END\"}"
```

List mine:

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/bookings/mine \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

**Expected:** `200`  
**Body:** array with at least 1 booking

---

### 4.8 Create booking — no token

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST $BASE/api/bookings \
  -H "Content-Type: application/json" \
  -d "{\"bayId\":1,\"startsAt\":\"$SLOT\",\"endsAt\":\"$SLOT_END\"}"
```

**Expected:** `401`

---

### 4.9 Owner — venue bookings

Ensure a player booking exists on venue 1 (run **4.4** if needed), then:

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/bookings/venue/1 \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

**Expected:** `200`  
**Body:** array with at least 1 booking

---

### 4.10 Player cannot view venue bookings

```bash
curl -s -w "\nHTTP %{http_code}\n" $BASE/api/bookings/venue/1 \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

**Expected:** `403`

---

## Quick checklist

| # | Test | Expected |
|---|------|----------|
| 1.1 | Health | 200 |
| 2.1 | Login player | 200 + token |
| 2.2 | Login owner | 200 + token |
| 2.3 | Wrong password | 401 |
| 2.4 | Login missing fields | 400 |
| 2.5 | Register new | 201 |
| 2.6 | Duplicate email | 409 |
| 2.7 | Register missing fields | 400 |
| 2.8 | /me with token | 200 |
| 2.9 | /me no token | 401 |
| 3.1 | List venues | 200 |
| 3.2 | Get venue | 200 + 3 bays |
| 3.3 | Venue 404 | 404 |
| 3.4 | Owner /mine | 200 |
| 3.5 | Player /mine | 403 |
| 4.1 | Availability free | 200 available:true |
| 4.2 | Availability no params | 400 |
| 4.3 | Availability bad times | 400 |
| 4.4 | Create booking | 201 |
| 4.5 | Booking conflict | 409 |
| 4.6 | Availability taken | 200 available:false |
| 4.7 | My bookings | 200 |
| 4.8 | Booking no token | 401 |
| 4.9 | Owner venue bookings | 200 |
| 4.10 | Player venue bookings | 403 |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Connection refused | Start server: `python run.py` |
| 401 on protected routes | Re-login and update `$PLAYER_TOKEN` / `$OWNER_TOKEN` |
| 409 on first booking test | Run `python -m app.seed` for clean DB |
| Empty venues list | Run `python -m app.seed` |
