# PJ Digital Store

A multi-app digital commerce project maintained as a fork of [`pj-digitals-estore/pj-digitals-estore`](https://github.com/pj-digitals-estore/pj-digitals-estore). The repository brings together customer, shop, delivery, and admin applications with a shared API server.

**Live site:** [pj-digitals-estore-server.vercel.app](https://pj-digitals-estore-server.vercel.app)

> This is a community-maintained fork. Changes in this repository may differ from the upstream project.

## Repository structure

| Directory | Purpose |
| --- | --- |
| `client/` | Customer-facing Expo app |
| `client_shop/` | Shop-facing Expo app |
| `client_delivery/` | Delivery-facing Expo app |
| `client_admin/` | Admin frontend demo |
| `server/` | Express API server using MongoDB and Clerk |
| `FRONTEND_CONNECTION.md` | Notes on connecting the apps to the server |

The admin frontend currently contains sample data and demo-only actions; it is not connected to live admin APIs or real customer, shop, or payout data.

## Prerequisites

- Node.js
- [pnpm](https://pnpm.io/) (the app packages specify pnpm `12.14.0`)
- Expo's supported tools for the platform you want to run (web, Android, or iOS)
- Server configuration and credentials for MongoDB and Clerk

## Run locally

Each app and the server is a separate package. Open a terminal in the relevant directory, install its dependencies, and start it.

### 1. Start the API server

```bash
cd server
pnpm install
pnpm start
```

The server needs its MongoDB URI and Clerk environment configuration. Set these in your local server environment; do not commit secrets. The frontend connection guide describes the expected local server address and app configuration.

### 2. Start an app

In another terminal, choose an app directory and start Expo:

```bash
cd client
pnpm install
pnpm start
```

Replace `client` with `client_shop`, `client_delivery`, or `client_admin` to run a different app. From the Expo CLI, choose the platform to open. You can also use the app scripts `pnpm web`, `pnpm android`, or `pnpm ios` where supported.

When running multiple Expo apps at once, use a different Expo port for each, for example:

```bash
pnpm expo start --port 8082
```

### Connect an app to the API

In each app, set `EXPO_PUBLIC_API_URL` in a local `.env.local` file to the server address. For example:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Use your computer's LAN IP for a physical device on the same network, or `http://10.0.2.2:3000` for the standard Android emulator. See [`FRONTEND_CONNECTION.md`](FRONTEND_CONNECTION.md) for additional details. Frontend environment variables are public app configuration—never put database passwords or Clerk secret keys in them.

## Development checks

The server package provides TypeScript checks/build commands:

```bash
cd server
pnpm typecheck
pnpm build
```

Expo apps provide a lint script:

```bash
cd client
pnpm lint
```

Run the relevant command from each app directory you change.

## Fork and contributions

This repository is a fork of [the upstream PJ Digital Store project](https://github.com/pj-digitals-estore/pj-digitals-estore). Please review upstream documentation and licensing before redistributing or contributing changes. Contributions to this fork should include a clear description of the change and any relevant testing notes.
