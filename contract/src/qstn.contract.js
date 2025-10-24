import { M } from '@endo/patterns';
import { E } from '@endo/far';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import * as crossChainFlow from './qstn.flows.js';
import { prepareAccountKit } from './qstn-account-kit.js';
import { makeTracer } from '@agoric/internal';

/**
 * @import {Remote, Vow} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {Marshaller, StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {ZCF} from '@agoric/zoe';
 */

const trace = makeTracer('AxelarGmp');

/**
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF} zcf
 * @param {OrchestrationPowers & {
 *   marshaller: Remote<Marshaller>;
 *   chainInfo?: Record<string, CosmosChainInfo>;
 *   assetInfo?: [Denom, DenomDetail & { brandKey?: string }][];
 *   storageNode: Remote<StorageNode>;
 * }} privateArgs
 * @param {Zone} zone
 * @param {OrchestrationTools} tools
 */
export const contract = async (
  zcf,
  privateArgs,
  zone,
  { chainHub, orchestrateAll, vowTools, zoeTools },
) => {
  trace('Inside Contract');

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );

  const creatorFacet = prepareChainHubAdmin(zone, chainHub);

  // UNTIL https://github.com/Agoric/agoric-sdk/issues/9066
  const logNode = E(privateArgs.storageNode).makeChildNode('log');
  /** @type {(msg: string) => Vow<void>} */
  const log = (msg) => vowTools.watch(E(logNode).setValue(msg));

  const { makeRemoteChannel: makeAxelarRemoteChannel } = orchestrateAll(
    { makeRemoteChannel: crossChainFlow.makeRemoteChannel },
    {
      chainName: 'Axelar',
      chainHub,
      log,
    },
  );

  const { makeRemoteChannel: makeOsmosisRemoteChannel } = orchestrateAll(
    { makeRemoteChannel: crossChainFlow.makeRemoteChannel },
    {
      chainName: 'Osmosis',
      chainHub,
      log,
    },
  );

  const { makeRemoteChannel: makeDydxRemoteChannel } = orchestrateAll(
    { makeRemoteChannel: crossChainFlow.makeRemoteChannel },
    {
      chainName: 'Dydx',
      chainHub,
      log,
    },
  );

  const axelarRemoteChannel = zone.makeOnce('AxelarRemoteChannel', () =>
    makeAxelarRemoteChannel(),
  );
  const osmosisRemoteChannel = zone.makeOnce('OsmosisRemoteChannel', () =>
    makeOsmosisRemoteChannel(),
  );
  const dydxRemoteChannel = zone.makeOnce('DydxRemoteChannel', () =>
    makeDydxRemoteChannel(),
  );

  const makeAccountKit = prepareAccountKit(zone.subZone('evmTap'), {
    zcf,
    vowTools,
    log,
    zoeTools,
  });

  const { createAndMonitorLCA } = orchestrateAll(
    { createAndMonitorLCA: crossChainFlow.createAndMonitorLCA },
    {
      makeAccountKit,
      log,
      chainHub,
      axelarRemoteChannel,
      osmosisRemoteChannel,
      dydxRemoteChannel,
    },
  );

  const publicFacet = zone.exo(
    'Send PF',
    M.interface('Send PF', {
      createAndMonitorLCA: M.callWhen().returns(M.any()),
    }),
    {
      createAndMonitorLCA() {
        return zcf.makeInvitation(
          createAndMonitorLCA,
          'makeAccount',
          undefined,
        );
      },
    },
  );

  return { publicFacet, creatorFacet };
};
harden(contract);

export const start = withOrchestration(contract);
harden(start);
