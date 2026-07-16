# Chess Game Suite ♟️

A comprehensive chess game codebase featuring a feature-rich modern **Web Application** (with multiplayer support, friends system, invite toasts, and real-time updates) and a classic **Desktop Pygame Application**.

---

## 🚀 Features

### 1. Modern Web Application (React & Node.js)
* **Real-time Online Multiplayer:** Live game play with opponents using WebSockets (`ws`).
* **Local Play Mode:** Pass-and-play local 2-player mode.
* **Authentication:** Secure user accounts via registration and login (utilizing `bcrypt` hashing and session cookies).
* **Friends & Invitation System:** Send invites, accept friend requests, and get interactive toast notifications to join games instantly.
* **Dual Database Support:** Runs seamlessly using **Dockerized PostgreSQL** or falls back automatically to **PGlite** (Postgres compiled to WebAssembly running directly in-process), persisting data locally in `server/.pgdata/` so development works out-of-the-box.
* **Stunning UI/UX:** Responsive design, animated route transitions via Framer Motion, and modern UI components.

### 2. Desktop Pygame Application (`Chess.py`)
* **Local 2-Player Play:** Classic chess board on desktop using Pygame.
* **Move Validation:** Powered by `python-chess` to highlight legal moves, handle selections, and detect checkmate.
* **Clean Graphics:** High-quality Unicode chess symbols and clean board colors.

---

## 🛠️ Tech Stack

### Web Frontend
* **Framework:** React 18 with TypeScript
* **Build Tool:** Vite
* **Styling:** Tailwind CSS + PostCSS
* **Animations:** Framer Motion
* **Routing:** React Router v7

### Web Backend
* **Runtime:** Node.js
* **Framework:** Express
* **Real-time:** WS (WebSockets)
* **Authentication:** Cookie-based sessions & `bcrypt`
* **Validation:** Zod
* **Database:** PostgreSQL (with `pg` client) & `@electric-sql/pglite` (WASM Postgres)

### Python Desktop App
* **Libraries:** Pygame, python-chess

---

## ⚙️ Project Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Python 3](https://www.python.org/) (for Pygame version)
* [Docker](https://www.docker.com/) (Optional, for running real PostgreSQL instance)

---

### 🖥️ 1. Web Application Setup

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Configure Environment Variables
Create a `.env` file in the root directory (one has been generated for you). You can customize the ports or Database URL:
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgres://chess:chess_dev_password@localhost:5432/chessgame
```

#### Step 3: Run the Database
You have two options for the database:
1. **PGlite (Zero Setup):** Do nothing! If Postgres is not running, the application will automatically spin up PGlite in WASM and persist your database to `server/.pgdata/`.
2. **PostgreSQL via Docker:**
   ```bash
   npm run db:up
   ```

#### Step 4: Run the Development Servers
Open two terminal windows (or run in background):

* **Run Backend API & WebSocket Server:**
  ```bash
  npm run server
  ```
  The API will start listening on `http://localhost:3001`.

* **Run Frontend Development Server:**
  ```bash
  npm run dev
  ```
  The frontend client will start on `http://localhost:5173`. Open this URL in your browser to play!

---

### 🐍 2. Pygame Desktop Application Setup

#### Step 1: Create a Virtual Environment (Optional but recommended)
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

#### Step 2: Install Python Libraries
```bash
pip install pygame chess
```

#### Step 3: Start the Game
```bash
python Chess.py
```

---

## 📁 Repository Structure
```
├── server/                 # Express backend server
│   ├── auth.ts             # Authentication logic (bcrypt & cookies)
│   ├── db.ts               # Database connection logic (PG / PGlite WASM)
│   ├── friends.ts          # Friends and invites router
│   ├── games.ts            # Chess game logic router
│   ├── index.ts            # API server entry point
│   ├── realtime.ts         # WebSocket connections & message routing
│   └── schema.sql          # DB initialization script
├── src/                    # Frontend React application
│   ├── components/         # Shared UI components
│   ├── lib/                # Auth & realtime context providers
│   ├── pages/              # Routing pages (Landing, Login, Friends, Play)
│   ├── App.tsx             # App shell and animated transitions
│   └── main.tsx            # React DOM mounting
├── Chess.py                # Desktop Pygame script
├── docker-compose.yml      # Docker container spec for PostgreSQL
├── package.json            # Node project configuration and scripts
├── .gitignore              # Files ignored in git tracking
└── .env                    # Environment variables (local-only)
```
