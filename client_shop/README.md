# TDP Store Shop (`client_shop`)

Standalone Expo Router / React Native TypeScript app for shop owners and staff. It follows the customer app's cream, deep green, and gold colors and compact card style. It uses React Native `StyleSheet`, as the current customer client does; NativeWind is not configured in the shared client.

## Add to PJ

Copy this complete `client_shop` folder beside `client`, `client_admin`, `client_delivery`, and `server` in the PJ repository. It is a separate Expo app, not a route inside `client/src/app`.

## Run locally

From this folder, install dependencies with the package manager the team has chosen, then run the web or native Expo start script. For npm on Windows: `npm.cmd install` and `npm.cmd run web`.

## Included screens

- Shop dashboard with sales, active orders, and low-stock items.
- Orders and delivery progress views.
- Product search and add-product form.
- Stock status, quantity controls, edit, and delete.
- Team list and local invite form.
- Store status and profile details.

Demo content is scoped to a sample Thodupuzha electronics shop and shown in rupees. All data is held in memory. Forms, order updates, staff invitations, and inventory changes do not call an API or persist after restart.
