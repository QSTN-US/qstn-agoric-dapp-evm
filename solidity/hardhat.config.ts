import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { config as envConfig } from 'dotenv';

envConfig();

const { PRIVATE_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      gasPrice: 225000000000,
      chainId: 43113,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
    },
    base: {
      url: 'https://sepolia.base.org/',
      gasPrice: 225000000000,
      chainId: 84532,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
    },
    eth: {
      url: 'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
      gasPrice: 225000000000,
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
    }
  },
  mocha: {
    timeout: 20000,
  },
};

export default config;
