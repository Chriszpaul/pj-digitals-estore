# Changelog

## Customer-matched refresh

- Matched the shop app colors, status badges, tab bar, cards, buttons, and inputs to the customer app's cream, green, and gold theme.
- Replaced the old Sri Lanka store and order sample data with a demo shop in Thodupuzha, India, using rupee prices and TDP-style order IDs.
- Updated sample product categories to Electronics, Computer Items, and Home Appliances to align with the customer catalogue.
- Kept the existing dashboard, orders, deliveries, products, stock editing/deletion, team, and store screens and their local demo interactions.
- Kept the app as a standalone Expo TypeScript folder; did not add NativeWind or backend calls.

## TypeScript preparation for PJ

- Prepared the shop-owner and staff Expo app as a separate `client_shop` folder.
- Converted app routes and screens from JavaScript to TSX.
- Converted shared UI and shop state context to typed TSX.
- Added product, order, delivery, team, and inventory types.
- Added TypeScript configuration and aligned the Expo version with PJ's client app.
- Kept sample data and demo-only local behavior; no backend integration was added.
- Kept the PJ repository untouched for manual copy by the user.
