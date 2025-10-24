/**
 * @import {Vow, VowTools} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {TypedPattern} from '@agoric/internal';
 * @import {ZoeTools} from '@agoric/orchestration/src/utils/zoe-tools.js';
 * @import {AccountTapState as AccountTapState, AxelarGmpOutgoingMemo} from '../types.js';
 * @import {ZCF, ZCFSeat} from '@agoric/zoe';
 * @import {CrossChainContractMessage} from "../utils/types.js"
 */

import { M, mustMatch } from '@endo/patterns';
import { VowShape } from '@agoric/vow';
import { makeTracer, NonNullish } from '@agoric/internal';
import { Fail } from '@endo/errors';
import { CosmosChainAddressShape } from '@agoric/orchestration';
import { gmpAddresses } from '../utils/gmp.js';
import { COSMOS_CHAINS } from '../utils/chains.js';

const trace = makeTracer('AccountKit', false);
const { entries } = Object;

const ACCOUNTI = M.interface('holder', {
  getNonce: M.call().returns(M.bigint()),
  getLocalAddress: M.call().returns(M.any()),
  send: M.call(M.any(), M.any()).returns(M.any()),
  sendTransactions: M.call(M.any(), M.any()).returns(M.any()),
  fundLCA: M.call(M.any(), M.any()).returns(VowShape),
});
harden(ACCOUNTI);

const InvitationMakerI = M.interface('invitationMaker', {
  makeTransactionInvitation: M.call(M.string(), M.array()).returns(M.any()),
});
harden(InvitationMakerI);

/** @type {TypedPattern<AccountTapState>} */
const AccountKitStateShape = {
  localChainAddress: CosmosChainAddressShape,
  localChainId: M.string(),
  localAccount: M.remotable('LocalAccount'),
  assets: M.any(),
};
harden(AccountKitStateShape);

/**
 * @param {Zone} zone
 * @param {{
 *   zcf: ZCF;
 *   vowTools: VowTools;
 *   log: (msg: string) => Vow<void>;
 *   zoeTools: ZoeTools;
 * }} powers
 */
export const prepareAccountKit = (zone, { zcf, vowTools, log, zoeTools }) => {
  return zone.exoClassKit(
    'AccountKit',
    {
      transferWatcher: M.interface('TransferWatcher', {
        onFulfilled: M.call(M.undefined())
          .optional(M.bigint())
          .returns(VowShape),
      }),
      holder: ACCOUNTI,
      invitationMakers: InvitationMakerI,
    },
    /**
     * @param {AccountTapState} initialState
     * @returns {AccountTapState}
     */
    (initialState) => {
      mustMatch(initialState, AccountKitStateShape);
      return harden({
        ...initialState,
      });
    },
    {
      transferWatcher: {
        /**
         * @param {void} _result
         * @param {bigint} value the qty of uatom to delegate
         */
        onFulfilled(_result, value) {
          trace('onFulfilled _result:', JSON.stringify(_result));
          trace('onFulfilled value:', JSON.stringify(value));
          trace('onFulfilled state:', JSON.stringify(this.state));
        },
      },
      holder: {
        getLocalAddress() {
          return this.state.localAccount.getAddress().value;
        },
        /**
         * Sends tokens from the local account to a specified Cosmos chain
         * address.
         *
         * @param {import('@agoric/orchestration').CosmosChainAddress} toAccount
         * @param {import('@agoric/orchestration').AmountArg} amount
         * @returns {Promise<string>} A success message upon completion.
         */
        async send(toAccount, amount) {
          await this.state.localAccount.send(toAccount, amount);
          return 'transfer success';
        },

        /**
         * @param {ZCFSeat} seat
         * @param {{
         *  messages: CrossChainContractMessage[]
         *  gasAmount: number;
         * }} offerArgs
         */
        async sendTransactions(seat, offerArgs) {
          void log('Inside sendTransactions');
          const { messages, gasAmount } = offerArgs;

          trace('Offer Args:', JSON.stringify(offerArgs));

          for (const message of messages) {
            message.destinationChain != null ||
              Fail`Destination chain must be defined for message ${message}`;
            message.destinationAddress != null ||
              Fail`Destination address must be defined for message ${message}`;
            const {
              destinationChain,
              destinationAddress,
              type,
              chainType,
              payload,
            } = message;

            const { give } = seat.getProposal();
            const [[_kw, amt]] = entries(give);
            amt.value > 0n ||
              Fail`IBC transfer amount must be greater than zero`;
            trace('_kw, amt', _kw, amt);
            trace(`targets: [${destinationAddress}]`);

            const { denom } = NonNullish(
              this.state.assets.find((a) => a.brand === amt.brand),
              `${amt.brand} not registered in vbank`,
            );
            trace('amt and brand', amt.brand);

            if (chainType === 'evm') {
              const remoteChannel = this.state.axelarRemoteChannel;

              const { chainId } = remoteChannel.remoteChainInfo;

              /** @type {AxelarGmpOutgoingMemo} */
              const memo = {
                destination_chain: destinationChain,
                destination_address: destinationAddress,
                payload: Array.from(payload),
                type,
              };

              if (type === 1 || type == 2) {
                memo.fee = {
                  amount: String(gasAmount),
                  recipient: gmpAddresses.AXELAR_GAS,
                };
                void log(`Fee object ${JSON.stringify(memo.fee)}`);
                trace(`Fee object ${JSON.stringify(memo.fee)}`);
              }

              void log(`Initiating IBC Transfer...`);
              void log(`DENOM of token:${denom}`);
              trace('Initiating IBC Transfer...');
              await this.state.localAccount.transfer(
                {
                  value: gmpAddresses.AXELAR_GMP,
                  encoding: 'bech32',
                  chainId,
                },
                {
                  denom,
                  value: amt.value,
                },
                { memo: JSON.stringify(memo) },
              );
            } else if (COSMOS_CHAINS.includes(chainType)) {
              const remoteChain = COSMOS_CHAINS[destinationChain];

              let remoteChannel;

              if (remoteChain == 'Osmosis') {
                remoteChannel = this.state.osmosisRemoteChannel;
              } else if (remoteChain == 'Dydx') {
                remoteChannel = this.state.dydxRemoteChannel;
              } else {
                Fail`Unsupported Cosmos chain: ${remoteChain}`;
              }

              const { chainId } = remoteChannel.remoteChainInfo;

              void log(`Initiating IBC Transfer to ${remoteChain}...`);
              trace(`Initiating IBC Transfer to ${remoteChain}...`);

              //todo: construct payload for cosmos chains
              const memo = JSON.stringify(payload);

              await this.state.localAccount.transfer(
                {
                  value: `agoric1${destinationAddress}`,
                  encoding: 'bech32',
                  chainId,
                },
                {
                  denom: remoteChannel.localDenom,
                  value: amt.value,
                },
                { memo },
              );
            }
          }

          seat.exit();
          void log('sendTransactions successful');
          return 'sendTransactions successful';
        },
        /**
         * @param {ZCFSeat} seat
         * @param {any} give
         */
        fundLCA(seat, give) {
          seat.hasExited() && Fail`The seat cannot be exited.`;
          return zoeTools.localTransfer(seat, this.state.localAccount, give);
        },
      },
      invitationMakers: {
        // "method" and "args" can be used to invoke methods of localAccount obj
        makeTransactionInvitation(method, args) {
          const continuingTransactionHandler = async (seat) => {
            await null;
            const { holder } = this.facets;
            switch (method) {
              case 'sendTransactions': {
                const { give } = seat.getProposal();
                await vowTools.when(holder.fundLCA(seat, give));
                return holder.sendTransactions(seat, args[0]);
              }
              case 'getLocalAddress': {
                const vow = holder.getLocalAddress();
                return vowTools.when(vow, (res) => {
                  seat.exit();
                  return res;
                });
              }
              case 'send': {
                const vow = holder.send(args[0], args[1]);
                return vowTools.when(vow, (res) => {
                  seat.exit();
                  return res;
                });
              }
              case 'fundLCA': {
                const { give } = seat.getProposal();
                const vow = holder.fundLCA(seat, give);
                return vowTools.when(vow, (res) => {
                  seat.exit();
                  return res;
                });
              }
              default:
                return 'Invalid method';
            }
          };

          return zcf.makeInvitation(
            continuingTransactionHandler,
            'transaction',
          );
        },
      },
    },
  );
};

/** @typedef {ReturnType<typeof prepareAccountKit>} MakeAccountKit */
/** @typedef {ReturnType<MakeAccountKit>} AccountKit */
