/**
 * @file Implements the orchestration flow which does the following:
 *
 *   - Sets up and monitors the QSTN Chain Account (LCA).
 *   - Coordinates IBC-related logic through `createAndMonitorLCA()`.
 *
 *   For more details, see: docs/axelar-gmp/create-and-use-wallet.mmd in
 *   orchestration package.
 */

import { makeTracer } from '@agoric/internal';
import { Fail } from '@endo/errors';
import { denomHash } from '@agoric/orchestration';
import { COSMOS_CHAINS } from '../utils/chains.js';

/**
 * @import {GuestInterface, GuestOf} from '@agoric/async-flow';
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {MakeAccountKit} from './qstn-account-kit.js';
 * @import {ChainHub} from '@agoric/orchestration/src/exos/chain-hub.js';
 * @import {Vow} from '@agoric/vow';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {SupportedCosmosChains, SupportedEVMChains, RemoteChannelInfo} from '../utils/types.js';
 */

const trace = makeTracer('CrossChainLCA');

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  makeAccountKit: MakeAccountKit;
 *  chainHub: GuestInterface<ChainHub>;
 *  log: GuestOf<(msg: string) => Vow<void>>;
 *  axelarRemoteChannel: Promise<RemoteChannelInfo>,
 *  osmosisRemoteChannel: Promise<RemoteChannelInfo>,
 *  dydxRemoteChannel: Promise<RemoteChannelInfo>,
 * }} ctx
 * @param {ZCFSeat} seat
 */
export const createAndMonitorLCA = async (
  orch,
  {
    makeAccountKit,
    chainHub,
    log,
    axelarRemoteChannel,
    osmosisRemoteChannel,
    dydxRemoteChannel,
  },
  seat,
) => {
  void log('Creating CrossChain LCA and monitoring transfers');

  const [agoric] = await Promise.all([orch.getChain('agoric')]);

  const localAccount = await agoric.makeAccount();
  void log('localAccount created successfully');
  const localChainAddress = await localAccount.getAddress();
  trace('Local Chain Address:', localChainAddress);

  const agoricChainId = (await agoric.getChainInfo()).chainId;

  const assets = await agoric.getVBankAssetInfo();

  const axelar = await axelarRemoteChannel;
  const osmosis = await osmosisRemoteChannel;
  const dydx = await dydxRemoteChannel;

  const accountKit = makeAccountKit({
    localAccount,
    localChainId: agoricChainId,
    localChainAddress,
    assets,
    axelarRemoteChannel: axelar,
    osmosisRemoteChannel: osmosis,
    dydxRemoteChannel: dydx,
  });

  void log('tap created successfully');
  // XXX consider storing appRegistration, so we can .revoke() or .updateTargetApp()
  // @ts-expect-error tap.receiveUpcall: 'Vow<void> | undefined' not assignable to 'Promise<any>'
  await localAccount.monitorTransfers(accountKit.tap);
  void log('Monitoring transfers setup successfully');

  seat.exit();
  // TODO: When used from the portfolio contract, expose the `holder` facet directly
  // to bypass Zoe and walletFactory, since smart wallet constraints don't apply there.
  return harden({ invitationMakers: accountKit.invitationMakers });
};
harden(createAndMonitorLCA);

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  chainName: SupportedCosmosChains;
 *  chainHub: GuestInterface<ChainHub>;
 *  log: GuestOf<(msg: string) => Vow<void>>;
 * }} ctx
 * @returns {Promise<RemoteChannelInfo>}
 */
export const makeRemoteChannel = async (orch, { chainName, chainHub, log }) => {
  const chain = COSMOS_CHAINS[chainName];

  const [agoric, remoteChain] = await Promise.all([
    orch.getChain('agoric'),
    orch.getChain(chain),
  ]);

  const { chainId, stakingTokens } = await remoteChain.getChainInfo();

  const remoteDenom = stakingTokens[0].denom;
  remoteDenom || Fail`${chainId} does not have stakingTokens in config`;

  void log(
    `Creating remote channel to ${chainName} (${chain}) with denom ${remoteDenom}`,
  );

  const agoricChainId = (await agoric.getChainInfo()).chainId;

  const { transferChannel } = await chainHub.getConnectionInfo(
    agoricChainId,
    chainId,
  );
  assert(transferChannel.counterPartyChannelId, 'unable to find sourceChannel');

  const localDenom = `ibc/${denomHash({
    denom: remoteDenom,
    channelId: transferChannel.channelId,
  })}`;

  const remoteChainInfo = await remoteChain.getChainInfo();

  return harden({
    localDenom,
    remoteChainInfo,
    channelId: transferChannel.channelId,
    remoteDenom,
  });
};

harden(makeRemoteChannel);
