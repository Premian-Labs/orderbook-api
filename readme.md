<p align="center">
  <img src="img/premia.png" alt=''>
</p>



## What is Premia?
Premia is a peer-to-peer options exchange and settlement engine built for the Ethereum Virtual Machine (EVM). 
The protocol is designed to provide a set of smart contracts that advance open finance by prioritizing security, 
self-custody, automatic execution without a trusted intermediary, and permissionless use of financial primitives.

## Premia Orderbook API
This repo contains the source code for a containerized API that can be run locally (or hosted on a server) to 
interact with the Premia v3 Orderbook and related protocol functionality for both professionals (market makers) and other 
advanced/programmatic users.  The containerized API allows for development in _any_ language.  Web3 functionality is 
abstracted away from the developer, shortening integration time.

## PreRequisites

There are several things that are needed in order to work with the API locally.  They include:

- An EOA (Externally Owned Account) on the Ethereum (funded on Arbitrum)
- An API Key from premia (please email support@premia.finance and use subject line 'API KEY REQUEST')
- Latest version of [Docker](https://docs.docker.com/get-docker/)
- An RPC provider (such as [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/))

## API Architecture
![](img/architecture.png)

