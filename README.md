# RoGrouper

A Roblox group management application.

## Running the Application

### Development

To run both the frontend and backend together:

```bash
npm install
cd backend && npm install && cd ..
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1 - Frontend (Next.js)
npm run dev

# Terminal 2 - Backend (Express)
npm run dev:backend
```

### Production

```bash
# Build both
npm run build
npm run build:backend

# Run both
npm run start          # Frontend on port 3000
npm run start:backend  # Backend on port 3001
```

## Backend Services

The backend server runs independently and provides:

- **Suspension Worker**: Automatically processes expired suspensions every 60 seconds, restoring users to their previous roles without requiring anyone to have the page open.
- **API endpoints**: Handles Roblox API interactions with proper authentication.

**Important**: The backend must be running for automatic suspension expiration to work. If only the frontend is running, suspensions will not automatically expire.

## Environment Variables

The backend reads environment variables from the root `.env.local` file. Required variables:

- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `ROBLOX_BOT_TOKEN` - Roblox bot .ROBLOSECURITY cookie
- `FRONTEND_URL` - URL of the frontend (default: http://66.228.59.100:3000)