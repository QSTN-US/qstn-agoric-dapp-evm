// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import dotenv from 'dotenv';

dotenv.config();

const { GATEWAY_CONTRACT, AGORIC_SENDER, CHAIN_NAME } = process.env;

if (!GATEWAY_CONTRACT || !AGORIC_SENDER || !CHAIN_NAME) {
  throw new Error(
    'GATEWAY_CONTRACT, AGORIC_SENDER, or CHAIN_NAME is not defined',
  );
}

console.log(`GATEWAY_CONTRACT: ${GATEWAY_CONTRACT}`);
console.log(`CHAIN_NAME: ${CHAIN_NAME}`);
console.log(`AGORIC_SENDER: ${AGORIC_SENDER}`);

export default buildModule('AxelarProxyModule', (m) => {
  const gateway = m.getParameter('gateway_', GATEWAY_CONTRACT);
  const sender = m.getParameter('sender_', AGORIC_SENDER);
  const chainName = m.getParameter('chainName_', CHAIN_NAME);
  const QuizzlerV2 = m.contract('QuizzlerV2', [gateway, sender, chainName]);
  return { QuizzlerV2 };
});
