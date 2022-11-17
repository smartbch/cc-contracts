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
    },
    sbch_local: {
      url: `http://localhost:8545`,
      gasPrice: 10500000000,
      accounts: [process.env.KEY || '0xe3d9be2e6430a9db8291ab1853f5ec2467822b33a1a08825a22fab1425d2bff9']
    },
    shagate_test1: {
      url: `http://18.141.161.139:8545`,
      gasPrice: 10500000000,
      accounts: [process.env.KEY || '0xe3d9be2e6430a9db8291ab1853f5ec2467822b33a1a08825a22fab1425d2bff9']
    }
  }
};
