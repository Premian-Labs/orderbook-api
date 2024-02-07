import axios from "axios";
import {Market} from "../types";
import {PREMIA_API_URL} from "../config";

const APIKey = process.env.REACT_APP_TESTNET_ORDERBOOK_API_KEY!

export async function getIVOracle(market: Market, spotPrice: number, strike: number, expiration: string) {
  const getIVResponse = await axios.get(PREMIA_API_URL + '/oracles/iv', {
    headers: {
      'x-apikey': APIKey,
    },
    params: {
      market: market,
      spotPrice: spotPrice,
      strike: strike,
      expiration: expiration,
    },
  })

  return getIVResponse.data
}