import { utils } from '../utils'
import axios from 'axios'
import Web3 from 'web3'
import config from '../config'
import BN from 'bn.js'
import Constants from '../../../shared/constants'
import Contract from 'web3-eth-contract'
const IERC20 = require('../../abi/IERC20.json')
const IERC20Metadata = require('../../abi/IERC20Metadata.json')
const IERC721 = require('../../abi/IERC721.json')
const IERC721Metadata = require('../../abi/IERC721Metadata.json')
const IERC1155 = require('../../abi/IERC1155.json')
const IERC1155MetadataURI = require('../../abi/IERC1155MetadataURI.json')
const headers = ({ secret, network }) => ({
  'X-SECRET': secret,
  'X-NETWORK': network,
})

console.log(config)

const TIMEOUT = 60000
const apiBase = axios.create({
  baseURL: config.server,
  headers: headers({ secret: config.secret, network: config.network }),
  timeout: TIMEOUT,
})

const web3 = new Web3(config.rpc)
Contract.setProvider(web3.currentProvider)

const getTokenContract = {
  ERC20: (address) => new Contract(IERC20, address),
  ERC721: (address) => new Contract(IERC721, address),
  ERC1155: (address) => new Contract(IERC1155, address)
}

const getTokenMetadataContract = {
  ERC20: (address) => new Contract(IERC20Metadata, address),
  ERC721: (address) => new Contract(IERC721Metadata, address),
  ERC1155: (address) => new Contract(IERC1155MetadataURI, address)
}

const apis = {
  web3: {
    web3,
    changeAccount: (key) => {
      web3.eth.accounts.wallet.clear()
      if (key) {
        const { address } = web3.eth.accounts.wallet.add(key)
        web3.eth.defaultAccount = address
      } else {
        web3.eth.defaultAccount = ''
      }
    },
    changeNetwork: (network) => {
      // TODO
    },
    getAddress: (key) => {
      if (typeof key !== 'string') {
        key = utils.hexString(key)
      }
      return web3.eth.accounts.privateKeyToAccount(key).address
    },
    isValidAddress: (address) => {
      try {
        return web3.utils.isAddress(address)
      } catch (ex) {
        console.error(ex)
        return false
      }
    },
    signWithNonce: (msg, key) => {
      const nonce = Math.floor(Date.now() / (config.defaultSignatureValidDuration)) * config.defaultSignatureValidDuration
      const message = `${msg} ${nonce}`
      return web3.eth.accounts.sign(message, key).signature
    },
  },
  blockchain: {
    getBalance: async ({ address }) => {
      const b = await web3.eth.getBalance(address)
      return new BN(b)
    },

    // returns Promise<BN>
    getTokenBalance: async ({ address, contractAddress, tokenType = '', tokenId }) => {
      if (!utils.isValidTokenType(tokenType)) {
        throw new Error(`Unknown token type: ${tokenType}`)
      }
      const c = await getTokenContract[tokenType](contractAddress)
      if (tokenType === 'ERC20') {
        return c.methods.balanceOf(address).call()
      } else if (tokenType === 'ERC721') {
        const owner = await c.ownerOf(tokenId)
        return owner === address ? new BN(1) : new BN(0)
      } else if (tokenType === 'ERC1155') {
        return c.methods.balanceOf(address, tokenId).call()
      } else {
        throw Error('unreachable')
      }
    },

    getTokenMetadata: async ({ tokenType, contractAddress, tokenId }) => {
      if (!utils.isValidTokenType(tokenType)) {
        throw new Error(`Unknown token type: ${tokenType}`)
      }
      const c = await getTokenMetadataContract[tokenType](contractAddress)
      let name, symbol, uri, decimals
      if (tokenType === 'ERC20') {
        [name, symbol, decimals] = await Promise.all([c.methods.name().call(), c.methods.symbol().call(), c.methods.decimals().call()])
      } else if (tokenType === 'ERC721') {
        [name, symbol, uri] = await Promise.all([c.methods.name().call(), c.methods.symbol().call(), c.methods.tokenURI(tokenId).call()])
      } else if (tokenType === 'ERC1155') {
        uri = await c.methods.uri(tokenId).call()
      } else {
        throw Error('unreachable')
      }
      return { name, symbol, uri, decimals: decimals && new BN(decimals).toNumber() }
    },
  },
  server: {
    signup: async ({ phone, eseed, ekey, address }) => {
      const { data } = await apiBase.post('/signup', { phone, eseed, ekey, address })
      const { hash } = data
      return hash
    },
    verify: async ({ phone, eseed, ekey, address, code, signature }) => {
      const { data } = await apiBase.post('/verify', { phone, eseed, ekey, address, code, signature })
      const { success } = data
      return success
    },
    restore: async ({ phone, eseed }) => {
      const { data } = await apiBase.post('/restore', { phone, eseed })
      const { success } = data
      return success
    },
    restoreVerify: async ({ phone, eseed, code }) => {
      const { data } = await apiBase.post('/restore-verify', { phone, eseed, code })
      const { ekey, address } = data
      return { ekey, address }
    },
    lookup: async ({ destPhone, address, signature }) => {
      const { data } = await apiBase.post('/lookup', { destPhone, address, signature })
      const { address: destAddress } = data
      return destAddress
    },
    settings: async ({ address, signature, newSetting = {} }) => {
      const { data } = await apiBase.post('/settings', { newSetting, address, signature })
      const { address: destAddress } = data
      return destAddress
    },
    requestView: async ({ address, signature, id }) => {
      const { data } = await apiBase.post('/request-view', { address, signature, id })
      const { request, hash } = data
      return { request, hash }
    },
    requestComplete: async ({ address, signature, id, txHash }) => {
      const { data } = await apiBase.post('/request-complete', { address, signature, id, txHash })
      const { success } = data
      return success
    }
  },
  nft: {
    getCachedData: async (address, tokenType, contractAddress, tokenId) => {
      return {}
    }
  }
}
if (window) {
  window.apis = apis
}
export default apis
