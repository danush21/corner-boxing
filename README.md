# 🥊 CORNER — AI Boxing Coach

A full-stack web application that uses your webcam and AI to coach you through shadow boxing sessions in real time. Built with the MERN stack + React + Vite.

---

## Stack

| Layer     | Tech                                      |
|-----------|-------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, Recharts    |
| ML        | TensorFlow.js, MoveNet (pose detection)   |
| Backend   | Node.js, Express                          |
| Database  | MongoDB + Mongoose                        |
| Auth      | JWT (jsonwebtoken + bcryptjs)             |
| AI Coach  | Anthropic Claude API (server-side proxy)  |

---

## Project Structure

```
corner-boxing/
├── server/                     # Express API
│   └── src/
│       ├── app.js              # Entry point
│       ├── models/             # Mongoose schemas
│       │   ├── User.js
│       │   └── Session.js
│       ├── controllers/        # Route handlers
│       │   ├── authController.js
│       │   ├── sessionController.js
│       │   └── userController.js
│       ├── routes/             # Express routers
│       │   ├── auth.js
│       │   ├── sessions.js
│       │   └── users.js
│       ├── middleware/
│       │   ├── auth.js         # JWT guard
│       │   └── errorHandler.js
│       └── services/
│           └── claudeService.js  # Claude API proxy
│
└── client/                     # React + Vite frontend
    └── src/
        ├── App.jsx             # Router setup
        ├── context/
        │   └── AuthContext.jsx # Global auth state
        ├── hooks/
        │   ├── useBoxingEngine.js  # All pose/punch/combo logic
        │   └── useSpeech.js        # TTS coaching
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── RegisterPage.jsx
        │   ├── CoachPage.jsx   # Main training view
        │   ├── HistoryPage.jsx # Past sessions
        │   ├── ProgressPage.jsx # Charts & trends
        │   └── SettingsPage.jsx
        ├── components/
        │   └── Layout.jsx      # Navbar + outlet
        └── services/
            └── api.js          # Axios + JWT interceptor
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB running locally (or a MongoDB Atlas URI)

### 1 — Clone & install

```bash
git clone <repo-url>
cd corner-boxing
npm install          # installs concurrently at root
npm run install:all  # installs server + client deps
```

### 2 — Configure the server

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/corner-boxing
JWT_SECRET=change_this_to_something_long_and_random
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### 3 — Run in development

```bash
npm run dev
```

This starts:
- **Server** on `http://localhost:5000`
- **Client** on `http://localhost:5173` (with `/api` proxied to the server)

### 4 — Add your Claude API key

1. Register an account in the app
2. Go to **Settings → Claude API Key**
3. Paste your key — it's stored server-side, never in the browser

---

## API Endpoints

### Auth
| Method | Route              | Description        |
|--------|--------------------|--------------------|
| POST   | /api/auth/register | Create account     |
| POST   | /api/auth/login    | Login              |
| GET    | /api/auth/me       | Get current user   |

### Sessions
| Method | Route                      | Description              |
|--------|----------------------------|--------------------------|
| GET    | /api/sessions              | List all sessions        |
| GET    | /api/sessions/:id          | Get session detail       |
| POST   | /api/sessions              | Save a session           |
| DELETE | /api/sessions/:id          | Delete a session         |
| GET    | /api/sessions/stats/progress | Progress chart data    |
| POST   | /api/sessions/coaching     | Request AI coaching      |

### Users
| Method | Route               | Description          |
|--------|---------------------|----------------------|
| PATCH  | /api/users/profile  | Update name/stance   |
| PATCH  | /api/users/api-key  | Store Claude API key |
| PATCH  | /api/users/password | Change password      |

---

## Features

- **Real-time pose detection** via MoveNet running in-browser
- **Punch detection** — jab, cross, hook, uppercut with velocity + dominance analysis
- **Combo detection** — 8 named combos with a 2.5s time window
- **Guard scoring** — shoulder-relative position analysis
- **Voice coaching** — Web Speech API reads tips & combo names aloud
- **AI coaching** — Claude analyses your session stats every 30 seconds
- **Session saving** — full session reports saved to MongoDB
- **Progress charts** — form scores, punch volume, duration trends via Recharts
- **JWT authentication** — secure per-user data
- **Southpaw/Orthodox stance** preference stored per user

---

## Production Deployment

```bash
# Build the client
npm run build

# Serve client/dist as static files from Express (add to server/src/app.js):
# app.use(express.static(path.join(__dirname, '../../client/dist')));
```

Deploy to Railway, Render, or any Node host. Set environment variables in your host dashboard.
