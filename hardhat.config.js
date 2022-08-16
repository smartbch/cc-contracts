require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // https://hardhat.org/hardhat-network/docs/reference
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: '10000000000000000000000000', // 10000000 ethers
      }
    }
  }
};
