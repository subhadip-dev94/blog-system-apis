# Blog API

Express + MongoDB (Mongoose) REST API. Collections: `users`, `posts`, `categories`, `comments`.

- **Data access:** every read uses a MongoDB aggregation pipeline (`$match`, `$lookup`, `$project`, `$facet`, ...). No `populate()` and no `find()`.
- **Auth:** JWT. Protected routes need the header `Authorization: Bearer <token>`.
- **Base URL:** `http://localhost:3000`

## Setup
```
npm install
copy .env.example .env     # then edit DB_URL, JWT_SECRET (and SMTP if you want real emails)
npm run dev
```
Without `EMAIL_HOST` the verification link is printed in the server console.

## Required APIs

| # | Method | Endpoint | Auth | Description |
|---|---|---|---|---|
| 1 | POST | `/api/auth/signup` | No | Register with `{name, email, password}`. Sends an email-verification link. |
| 2 | GET | `/api/auth/verify-email/:token` | No | Verifies the account from the emailed link. The token is single-use and expires after 24 hours. |
| 3 | POST | `/api/auth/login` | No | Log in with `{email, password}`. Returns a JWT. Unverified accounts are refused. |
| 4 | GET | `/api/users/me` | Yes | Profile of the logged-in user, including bio and profile picture. |
| 5 | PUT | `/api/users/me` | Yes | Edit profile (`multipart/form-data`): `name`, `bio`, `profilePicture` (jpg, png or webp, max 2 MB). |
| 6 | POST | `/api/categories` | Yes | Add a category with `{name, description}`. Names are unique, ignoring case. |
| 7 | POST | `/api/posts` | Yes | Create a post with `{title, content, category, tags}`. The author is taken from the token. |
| 8 | GET | `/api/categories` | No | Every category with `totalPosts` and the list of its posts. |
| 9 | PUT | `/api/posts/:id` | Yes (author only) | Edit title, content, category and tags. Other users get 403. |
| 10 | DELETE | `/api/posts/:id` | Yes (author only) | Delete a post and its comments. |
| 11 | GET | `/api/posts?page=1&limit=10` | No | Posts sorted by number of likes, highest first, with pagination (single `$facet` aggregate for page + total). |

## Supporting APIs (extra)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/resend-verification` | No | Resend the verification email with `{email}`. |
| POST | `/api/posts/:id/like` | Yes | Like or unlike a post. This feeds the likes sorting (#11). |
| POST | `/api/posts/:id/comments` | Yes | Add a comment with `{text}`, which uses the Comments collection. |
| GET | `/api/posts/:id` | No | One post with its author, category, likes count and comments. |

## Testing
- All 46 test cases passed against a live MongoDB. They covered every endpoint above, including the failure cases (invalid input, missing token, wrong owner, unknown id).
- Import `postman_collection.json` into Postman. Run Signup, open the verification link printed in the console (or emailed), then Login: the token is saved automatically and used by the other requests.

## Notes
- Category listing returns a 200-character `excerpt` per post; fetch `GET /api/posts/:id` for the full content.
- Limits: title 200, category name 100, description 500, bio 500 characters; max 10 tags (30 characters each).
- Set `TRUST_PROXY=1` when running behind a reverse proxy.
