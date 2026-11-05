# TDP Store Delivery (`client_delivery`)

Standalone Expo Router / React Native TypeScript frontend for delivery partners. It follows the customer app's warm cream, deep green, and gold visual theme and uses React Native `StyleSheet`, matching the current client.

## Add to PJ

Copy this complete `client_delivery` folder beside `client`, `client_shop`, and `server` in the PJ repository. It is a separate Expo app, not a route inside the customer app.

## Run locally

From this folder, install dependencies with the package manager your team has chosen, then run the web or native Expo start script. For npm on Windows: `npm.cmd install` and `npm.cmd run web`.

## Screens in this frontend demo

- Home shift summary, online/offline control, and assigned jobs.
- Delivery details with pickup/drop-off, progress, demo OTP, and status actions.
- Weekly earnings and payout preview.
- Delivery profile, service area, vehicle, and support preview.

Jobs, earnings, and profile details are sample data. Status changes stay in app memory; map directions, masked calls, identity checks, and payout services are not connected.
