# Indoor Cricket Net Platform

Web platform for booking indoor cricket nets and organizing pickup softball games (Sri Lanka MVP).

## Stack

- **Backend:** Flask + SQLAlchemy + SQLite
- **Frontend:** React (coming soon)

## Quick start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
python run.py
```

API health check: http://127.0.0.1:5000/api/health

### Demo accounts (after seed)

| Role   | Email           | Password   |
|--------|-----------------|------------|
| Owner  | owner@nets.lk   | owner123   |
| Player | player@nets.lk  | player123  |

Database file: `backend/instance/indoor_cricket.db`
