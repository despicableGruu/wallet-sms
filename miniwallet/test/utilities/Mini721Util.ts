import { ethers } from 'hardhat'
const { BigNumber } = require('ethers')
const { ethers: { constants: { MaxUint256 } } } = require('ethers')

export const BASE_TEN = 10
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'

export function encodeParameters (types, values) {
  const abi = new ethers.utils.AbiCoder()
  return abi.encode(types, values)
};

export async function prepare721 (thisObject, contracts) {
  for (const i in contracts) {
    const contract = contracts[i]
    thisObject[contract] = await ethers.getContractFactory(contract)
  }
  thisObject.signers = await ethers.getSigners()
  thisObject.alice = thisObject.signers[0]
  thisObject.bob = thisObject.signers[1]
  thisObject.carol = thisObject.signers[2]
  thisObject.dev = thisObject.signers[3]
  thisObject.alicePrivateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  thisObject.bobPrivateKey =
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
  thisObject.carolPrivateKey =
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
  thisObject.Mini721 = await ethers.getContractFactory('Mini721')
}

export async function deploy721 (thisObject, contracts) {
  for (const i in contracts) {
    const contract = contracts[i]
    thisObject[contract[0]] = await contract[1].deploy(...(contract[2] || []))
    await thisObject[contract[0]].deployed()
  }
}

export async function userMint721 (thisObject, minter, numTokens) {
  const mintPrice = await thisObject.mini721.mintPrice()
  // console.log(`mintPrice: ${JSON.stringify(mintPrice)}`)
  const tx = await thisObject.mini721.connect(minter).mintMini(numTokens, {
    value: mintPrice.mul(numTokens)
  })
  return tx
}

export async function communityMint721 (thisObject, owner, numTokens) {
  const tx = await thisObject.mini721.mintForCommunity(owner, numTokens)
  return tx
}
