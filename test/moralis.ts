import dotenv from 'dotenv';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import { walletAddr }  from '../src'
import moment from 'moment';
import { formatEther } from 'ethers';
import arb from '../src/config/arbitrum.json'
import arbGoerli from '../src/config/arbitrumGoerli.json'
import { NFTObject } from '../src/helpers/types';


dotenv.config();

if (!process.env.MORALIS_KEY || !process.env.ENV) {
    throw new Error(`Balance Credentials Missing`);
}

// NOTE: Moralis Wallet API does not work for ARBITRUM_TESTNET
const chain =
    process.env.ENV === 'production' ? EvmChain.ARBITRUM : EvmChain.GOERLI;
const availableTokens = process.env.ENV === 'production' ? Object.keys(arb.tokens) : Object.keys(arbGoerli.tokens)


async function getPositions(_address: string) {
    await Moralis.start({
        apiKey: process.env.MORALIS_KEY,
    });

    //========================================================================================================================================

    const nativeBalance = await Moralis.EvmApi.balance.getNativeBalance({
        chain: chain,
        address: _address,
    });

    console.log(nativeBalance.toJSON());

    /*
     { balance: '16252939612884666622' }
     */

    //========================================================================================================================================

    const tokenBalances = await Moralis.EvmApi.token.getWalletTokenBalances({
        chain: chain,
        address: _address,
    });

    const filteredTokenBalances = tokenBalances.toJSON().filter (token => {
      return availableTokens.includes(token.symbol)
    })

    const finalTokenBalances = filteredTokenBalances.map(
      ({name, logo, thumbnail, possible_spam, decimals, ...item}) => item
    )

    console.log(finalTokenBalances)

    /*
    [
      {
        token_address: '0x326c977e6efc84e512bb9c30f76e30c160ed06fb',
        symbol: 'LINK',
        balance: '20000000000000000000'
      },
    ]
     */
    //========================================================================================================================================

    // TODO: Check potential pagination issue
    const moralisResponse = await Moralis.EvmApi.nft.getWalletNFTs({
        chain: chain,
        format: 'decimal',
        disableTotal: false,
        mediaItems: false,
        address: _address,
    });

    const NFTBalances= moralisResponse.toJSON().result
    if (NFTBalances === undefined)
        return []

    let balances: NFTObject[] = []

    NFTBalances.forEach(NFTBalance => {
        const product = NFTBalance.name.split('-')

        const approvedTokens = availableTokens.includes(product[0]) && availableTokens.includes(product[1])
        const approvedOptionType = (product[4] === 'P' || product[4] === 'C')
        const approvedStrike = !isNaN(Number(product[3]))
        const approvedExp = moment(product[2], "DDMMMYYYY").isValid()

       if (approvedTokens && approvedOptionType && approvedStrike && approvedExp){
           balances.push({
               name: NFTBalance.name,
               token_address: NFTBalance.token_address,
               amount: NFTBalance.amount!
           })
       }
    })

    console.log(balances)

    /*
    [
      {
        name: 'WETH-USDC-26MAY2023-1500-P',
        token_address: '0x8b72e7aa124dd5ceecac3cead9532ea0de0bedea',
        amount: '200000000000000000'
      },
      {
        name: 'WETH-USDC-26MAY2023-1500-P',
        token_address: '0x8b72e7aa124dd5ceecac3cead9532ea0de0bedea',
        amount: '200000000000000000'
      }
    ]
    */
}

getPositions(walletAddr)
  .then(() => process.exit(0))
  .catch((error) => {
      console.error(error);
      process.exit(1);
  });
