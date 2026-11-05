# TDP Store Admin (`client_admin`)

Standalone Expo Router / React Native TypeScript frontend, styled to match the customer app's warm cream, deep green, and gold theme. The screens use React Native `StyleSheet`, like the current customer app; NativeWind is not configured in the client yet.

## Add to PJ

Copy this complete `client_admin` folder beside `client`, `client_shop`, and `server` in the PJ repository. It is a separate Expo app, not a route inside the customer app.

## Run locally

From this folder, install dependencies with the package manager your team has chosen, then run the web or native Expo start script. For npm on Windows: `npm.cmd install` and `npm.cmd run web`.

## Screens in this frontend demo

- Platform overview with sales/order/shop summary and attention queue.
- Orders with search and local demo status actions.
- Shop applications with approve/decline demo actions.
- Product catalogue, delivery operations, customer list, payouts, support, reports, and settings previews.

All data and actions are sample-only and reset when the app restarts. No API, real shop approval, payout, messaging, or customer data access is connected.
