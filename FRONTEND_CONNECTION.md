# Connecting the four apps

The customer, shop, admin and delivery apps now call the existing server's `GET /` endpoint. Their connection bar shows whether the expected server response was received. This confirms reachability only: login, products, stock, ads, orders and delivery updates still use the existing frontend previews because the server has no APIs for them. The Clerk webhook is a server-to-server endpoint and is not called by the apps.

## Server

Start the existing server from `server` with `pnpm install`, then `pnpm start`. It requires its existing `MONGODB_URI` and Clerk environment configuration; this change does not create credentials or alter the backend. The server waits for MongoDB before listening on port 3000 (or its configured PORT).

## Apps

In development, each app defaults to the Expo computer's host on port 3000. The browser uses its current hostname. This is intended for a local LAN development server, not an Expo tunnel or hosted web preview.

To select another address, create `.env.local` in each of `client`, `client_shop`, `client_admin`, and `client_delivery`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000
```

For a web app on the server computer, use `http://localhost:3000`. For an Android emulator use `http://10.0.2.2:3000`. Physical phones must use the computer's LAN address, be on the same network and be able to reach the server port. Use an HTTPS URL for hosted or production apps; an HTTPS webpage cannot connect to an HTTP server. Native production networking policies may also block cleartext HTTP.

Start each Expo app with `pnpm expo start`. Use separate Expo ports when running several at once, for example 8081, 8082, 8083 and 8084 via `pnpm expo start --port 8082`. Reload the app after changing its environment file.

The address is public application configuration. Do not put database passwords or Clerk secret keys in frontend environment files. Production builds require an explicit server address; development fallback is disabled there.

Requests time out after eight seconds. A connection check runs on launch, every minute while the app is active, on return to the app, and when Retry is pressed. Checks cancel when their component unmounts. No sample response is substituted for a failed server request.
