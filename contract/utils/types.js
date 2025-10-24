import '@agoric/vats/src/types.js';

/**
 * @import {AxelarGMPMessageType} from '../utils/gmp';
 * @import {COSMOS_CHAINS, EVM_CHAINS, ActiveChainType} from './chains.js';
 * @import {ChainInfo} from "@agoric/orchestration/src/orchestration-api.js"
 */

/**
 * @typedef {(typeof AxelarGMPMessageType)[keyof typeof AxelarGMPMessageType]} GMPMessageType
 */

/**
 * @typedef {(typeof ActiveChainType)[keyof typeof ActiveChainType]} ChainType
 */

/**
 * @typedef {keyof typeof EVM_CHAINS} SupportedEVMChains
 */

/**
 * @typedef {keyof typeof COSMOS_CHAINS} SupportedCosmosChains
 */

// Contract Call should contain a list of addresses
/**
 * @typedef {object} CrossChainContractMessage
 * @property {string} destinationAddress
 * @property {GMPMessageType} type
 * @property {ChainType} chainType
 * @property {any} payload
 * @property {SupportedEVMChains | SupportedCosmosChains} destinationChain
 *
 */

/**
 *  @typedef {{
 *   localDenom: string;
 *   remoteChainInfo: ChainInfo;
 *   channelId: string;
 *   remoteDenom: string;
 * }} RemoteChannelInfo
 */

export {};
