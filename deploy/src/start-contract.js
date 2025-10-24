/// <reference types="@agoric/vats/src/core/types-ambient"/>

import {
  deeplyFulfilledObject,
  makeTracer,
  NonNullish,
} from '@agoric/internal';
import { E } from '@endo/far';

/**
 * @import {Issuer} from '@agoric/ertp';
 * @import {Installation, Instance} from '@agoric/zoe/src/zoeService/utils.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {start as StartFn} from 'contract/src/qstn.contract.js';
 */

const trace = makeTracer('start qstn contract', true);

/**
 * @param {BootstrapPowers & {
 *   installation: {
 *     consume: {
 *       qstnContract: Installation<StartFn>;
 *     };
 *   };
 *   instance: {
 *     produce: {
 *       qstnContract: Producer<Instance<StartFn>>
 *     };
 *   };
 *   issuer: {
 *     consume: {
 *       BLD: Issuer<'nat'>;
 *       IST: Issuer<'nat'>;
 *     };
 *   };
 * }} powers
 * @param {{
 *   options: {
 *     chainInfo: Record<string, CosmosChainInfo>;
 *     assetInfo: [Denom, DenomDetail & { brandKey?: string }][];
 *   };
 * }} config
 */
export const startQstnContract = async (
  {
    consume: {
      agoricNames,
      board,
      chainStorage,
      chainTimerService,
      cosmosInterchainService,
      localchain,
      startUpgradable,
    },
    installation: {
      consume: { qstnContract },
    },
    instance: {
      produce: { qstnContract: produceInstance },
    },
    issuer: {
      consume: { BLD, IST },
    },
  },
  { options: { chainInfo, assetInfo } },
) => {
  trace(startQstnContract.name);

  const marshaller = await E(board).getReadonlyMarshaller();

  trace('Setting privateArgs');

  const privateArgs = await deeplyFulfilledObject(
    harden({
      agoricNames,
      localchain,
      marshaller,
      orchestrationService: cosmosInterchainService,
      storageNode: E(NonNullish(await chainStorage)).makeChildNode(
        'qstnContract',
      ),
      timerService: chainTimerService,
      chainInfo,
      assetInfo,
    }),
  );

  /** @param {() => Promise<Issuer>} p */
  const safeFulfill = async (p) =>
    E.when(
      p(),
      (i) => i,
      () => undefined,
    );

  const axlIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'AXL'),
  );

  // const wavaxIssuer = await safeFulfill(() =>
  //   E(agoricNames).lookup('issuer', 'WAVAX'),
  // );

  const issuerKeywordRecord = harden({
    BLD: await BLD,
    IST: await IST,
    ...(axlIssuer && { AXL: axlIssuer }),
    // ...(wavaxIssuer && { WAVAX: wavaxIssuer }),
  });
  trace('issuerKeywordRecord', issuerKeywordRecord);

  trace('Starting contract instance');
  const { instance } = await E(startUpgradable)({
    label: 'qstnContract',
    installation: qstnContract,
    issuerKeywordRecord,
    privateArgs,
  });
  produceInstance.resolve(instance);
  trace('done');
};
harden(startQstnContract);

export const getManifest = ({ restoreRef }, { installationRef, options }) => {
  return {
    manifest: {
      [startQstnContract.name]: {
        consume: {
          agoricNames: true,
          board: true,
          chainTimerService: true,
          chainStorage: true,
          cosmosInterchainService: true,
          localchain: true,

          startUpgradable: true,
        },
        installation: {
          consume: { qstnContract: true },
        },
        instance: {
          produce: { qstnContract: true },
        },
        issuer: {
          consume: { BLD: true, IST: true },
        },
      },
    },
    installations: {
      qstnContract: restoreRef(installationRef),
    },
    options,
  };
};
