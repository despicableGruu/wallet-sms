const config = require('./config')
const { ethers, BigNumber: BN } = require('ethers')
const { Logger } = require('./logger')
const cloneDeep = require('lodash/fp/cloneDeep')
const { backOff } = require('exponential-backoff')
const { rpc } = require('./rpc')
const AssetManager = require('../miniwallet/build/contracts/AssetManager.sol/AssetManager.json')

let networkConfig = {}
let provider
const pendingNonces = {}
const signers = []
const assetManagers = []
const walletPath = 'm/44\'/60\'/0\'/0/' // https://docs.ethers.io/v5/api/signer/#Wallet.fromMnemonic'

const init = async () => {
  Logger.log('Initializing blockchain for server')
  try {
    Logger.log(`config.defaultNetwork: ${config.defaultNetwork}`)
    networkConfig = config.networks[config.defaultNetwork]
    Logger.log(`network: ${JSON.stringify(networkConfig)}`)
    provider = ethers.getDefaultProvider(networkConfig.url)
    provider.pollingInterval = config.pollingInterval
    if (networkConfig.mnemonic) {
      for (let i = 0; i < networkConfig.numAccounts; i += 1) {
        const path = walletPath + i.toString()
        Logger.log(`path: ${path}`)
        const signer = new ethers.Wallet.fromMnemonic(networkConfig.mnemonic, path)
        signers[i] = signer.connect(provider)
      }
    } else {
      signers[0] = new ethers.Wallet(networkConfig.key, networkConfig.provider)
    }
    for (let i = 0; i < signers.length; i += 1) {
      Logger.log(`signers[${i}].address; ${JSON.stringify(signers[i].address)}`)
      assetManagers[i] = new ethers.Contract(networkConfig.assetManagerAddress, AssetManager.abi, signers[i])
    }
  } catch (ex) {
    console.error(ex)
    console.trace(ex)
  }
}

const sampleExecutionAddress = () => {
  const nonces = cloneDeep(pendingNonces)
  const probs = []
  let sum = 0
  for (const signer of signers) {
    const p = 1.0 / Math.exp(nonces[signer.address])
    probs.push(p)
    sum += p
  }
  const r = Math.random() * sum
  let s = 0
  for (let i = 0; i < probs.length; i++) {
    s += probs[i]
    if (s >= r) {
      return [i, signers[i].address, assetManagers[i]]
    }
  }
  return [signers.length - 1, signers[signers.length - 1].address, assetManagers[assetManagers.length - 1]]
}

// basic executor that
const prepareExecute = (logger = Logger.log, abortUnlessRPCError = true) => async (f) => {
  const [fromIndex, from, assetManager] = sampleExecutionAddress()
  logger(`Sampled [${fromIndex}] ${from}`)
  const latestNonce = await rpc.getNonce({ address: from, network: config.defaultNetwork })
  const snapshotPendingNonces = pendingNonces[from]
  const nonce = latestNonce + snapshotPendingNonces
  pendingNonces[from] += 1
  const t0 = performance.now()
  const elapsed = () => (performance.now() - t0).toFixed(3)
  const printNonceStats = () => `[elapsed=${elapsed()}ms][network=${config.defaultNetwork}][account=${fromIndex}][nonce=${nonce}][snapshot=${snapshotPendingNonces}][current=${pendingNonces[from]}]`
  try {
    logger(`[pending]${printNonceStats()}`)
    let numAttempts = 0
    const tx = await backOff(
      async () => f({
        from,
        nonce: '0x' + new BN(nonce).toString(16),
        gasPrice: config.gasPrice.clone().muln((numAttempts || 0) + 1),
        value: 0,
      }), {
        retry: (ex, n) => {
          if (ex?.abort) {
            console.error('[error-abort]', ex)
            logger(`[abort][attempts=${n}]${printNonceStats()}`)
            return false
          }
          if (!ex?.receipt && !ex?.response?.data && abortUnlessRPCError) {
            console.error('[error-abort-before-rpc]', ex)
            logger(`[abort-before-rpc][attempts=${n}]${printNonceStats()}`)
            return false
          }
          console.error('[error]', ex?.response?.status, ex)
          numAttempts = n
          logger(`[retry][attempts=${n}]${printNonceStats()}`)
          return true
        }
      })
    logger(`[complete]${printNonceStats()}`, JSON.stringify(tx, null, 2))
    return tx
  } catch (ex) {
    logger(`[error]${printNonceStats()}`, ex)
    throw ex
  } finally {
    pendingNonces[from] -= 1
  }
}

module.exports = {
  init,
  getNetworkConfig: () => networkConfig,
  getProvider: () => provider,
  getSigners: () => signers,
  getAssetManagers: () => assetManagers,
  prepareExecute
}
