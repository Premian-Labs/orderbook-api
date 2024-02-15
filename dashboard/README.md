<p align="center">
  <img src="../img/premia.png" alt='logo' height="50">
</p>

## Premia Market Maker Live Dashboard
A lightweight UI for containerised API build on top of Premia Containerized API featuring live Premia Orderbook state, live list of active positions, programmatic user setting, etc.

## How to run

1. Make sure to populate [.env](.env) according to [.env.example](.env.example). 
`REACT_APP_WALLET_ADDRESS` should match your `WALLET_ADDRESS` from [Containerized API .env](../.env), and `REACT_APP_MAINNET_ORDERBOOK_API_KEY` should match `MAINNET_ORDERBOOK_API_KEY`.
2. Make sure to set `ENV=production` in [Containerized API .env](../.env)
3. Make sure [Docker Compose](https://docs.docker.com/compose/) is installed. 
4. Open a terminal session, from the UI App root directory (`dashboard`), run  `docker-compose up`. This will build and spin Premia Containerized API and Premia Live Dashboard containers. 
5. Containerized API will be accessible on `http://localhost:3000`, and Premia Live Dashboard on `http://localhost:3010` respectively. 
6. To stop the container run `docker-compose down`.

## Limitations
The purpose of the UI app is solely to be a read-only lightweight dashboard, all state-mutating operations (like posting, cancelling and filling quotes, modifying collateral allowance) are only available via Containerized API.
The app does not work on testnet.
