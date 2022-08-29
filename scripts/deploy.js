// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  // deploy CCMonitorsGov
  const CCMonitorsGov = await hre.ethers.getContractFactory("CCMonitorsGov");
  const ccMonitorsGov = await CCMonitorsGov.deploy();
  await ccMonitorsGov.deployed();
  console.log("CCMonitorsGov deployed to:", ccMonitorsGov.address);

  // deploy CCOperatorsGov
  const CCOperatorsGov = await hre.ethers.getContractFactory("CCOperatorsGov");
  const ccOperatorsGov = await CCOperatorsGov.deploy();
  await ccOperatorsGov.deployed();
  console.log("CCOperatorsGov deployed to:", ccOperatorsGov.address);

  // deploy CCEnclaveNodesGov
  const CCEnclaveNodesGov = await hre.ethers.getContractFactory("CCEnclaveNodesGov");
  const ccEnclaveNodesGov = await CCEnclaveNodesGov.deploy(ccMonitorsGov.address, []);
  await ccEnclaveNodesGov.deployed();
  console.log("CCEnclaveNodesGov deployed to:", ccEnclaveNodesGov.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
