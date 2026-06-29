# Pulse — Mini Social Media Platform

A full-stack social media app built with **Express.js** and vanilla **HTML/CSS/JS**.

## Features

- **User Profiles** — Register/login, edit your name & bio, view follower/following counts
- **Posts** — Create, view, and delete posts (up to 280 characters). Feed shows only posts from people you follow.
- **Comments** — Comment on any post, delete your own comments
- **Likes** — Like/unlike posts with live count updates
- **Follow System** — Follow/unfollow users; personalized feed; suggestions panel
- **Explore** — Discover all users and posts; real-time user search

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | HTML5, CSS3 (custom), Vanilla JS  |
| Backend    | Node.js + Express.js              |
| Database   | In-memory (Map/Set) — no setup    |
| Auth       | Session tokens (crypto.randomBytes)|
| Passwords  | SHA-256 hashing (crypto module)   |

## Project Structure

```
pulse-social/
├── server.js          # Express API server
├── package.json
└── public/
    ├── index.html     # SPA shell
    ├── css/
    │   └── style.css  # All styles
    └── js/
        └── app.js     # Frontend logic & API calls
```

## API Endpoints

### Auth
| Method | Path                | Description        |
|--------|---------------------|--------------------|
| POST   | /api/auth/register  | Create account     |
| POST   | /api/auth/login     | Login              |
| POST   | /api/auth/logout    | Logout             |

### Users
| Method | Path                         | Description         |
|--------|------------------------------|---------------------|
| GET    | /api/me                      | My profile          |
| PATCH  | /api/me                      | Update my profile   |
| GET    | /api/users                   | List/search users   |
| GET    | /api/users/:username         | User profile        |
| GET    | /api/users/:username/posts   | User's posts        |
| POST   | /api/users/:id/follow        | Follow/unfollow     |

### Posts
| Method | Path                      | Description         |
|--------|---------------------------|---------------------|
| GET    | /api/feed                 | Personalized feed   |
| GET    | /api/posts                | All posts           |
| POST   | /api/posts                | Create post         |
| DELETE | /api/posts/:id            | Delete post         |
| POST   | /api/posts/:id/like       | Like/unlike         |

### Comments
| Method | Path                         | Description         |
|--------|------------------------------|---------------------|
| POST   | /api/posts/:id/comments      | Add comment         |
| DELETE | /api/comments/:id            | Delete comment      |

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
# → Server running → http://localhost:3000

# 3. Open http://localhost:3000 in your browser
```

## Demo Accounts

| Username      | Password     |
|---------------|--------------|
| aurora_nova   | password123  |
| felix_storm   | password123  |
| mira_bloom    | password123  |

> **Note:** Data is in-memory and resets on server restart.  
> To add persistent storage, replace the `db` object in `server.js` with SQLite/PostgreSQL.

## Adding a Real Database

The server uses a clean separation between routes and data. To switch to SQLite:

```bash
npm install better-sqlite3
```

Then replace the `db` Map/Set operations in `server.js` with SQL queries. The API shape stays identical.
