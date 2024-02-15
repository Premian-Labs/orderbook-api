<p align="center">
  <img src="../img/premia.png" alt='logo' height="50">
</p>

## Premia Orderbook Dashboard
A read-only lightweight UI of Premia's Containerized API featuring live orderbook state, active positions, user setting, etc.

## Limitations
The app does not run on testnet.

## Start Guide

1. Prior to running the Orderbook Dashboard, read [setup instructions](../readme.md) for the Containerized API.
2. Make sure to populate the Dashboard [.env](.env) according to [.env.example](.env.example). 
`REACT_APP_WALLET_ADDRESS` should match your `WALLET_ADDRESS` from [Containerized API .env](../.env), and `REACT_APP_MAINNET_ORDERBOOK_API_KEY` should match `MAINNET_ORDERBOOK_API_KEY`.
3. Make sure to set `ENV=production` in [Containerized API .env](../.env)
4. We recommend using [Docker Compose](https://docs.docker.com/compose/) to run the container on a local host. 
5. Open a terminal session, from the Dashboard root directory (`dashboard`) run `docker-compose up`. This will build and spin Containerized API and Dashboard containers. 
6. Containerized API will be accessible on `http://localhost:3000`, and the Dashboard on `http://localhost:3010` respectively.
7. To stop both containers run `docker-compose down`.
