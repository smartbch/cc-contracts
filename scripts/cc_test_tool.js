const yargs = require('yargs');
const hre = require("hardhat");

const ethers = hre.ethers;

const ccSysAddr = '0x0000000000000000000000000000000000002714';
const ccSysABI = [
  "function startRescan(uint256 mainFinalizedBlockHeight) external",
  "function pause() external",
  "function resume() external",
  "function handleUTXOs() external",
  "function redeem(uint256 txid, uint256 index, address targetAddress) external",
];

yargs(process.argv.slice(2))
  .command('start-rescan', 'start rescan by monitor', (yargs) => {
    return yargs
      .option('height', {required: true, type: 'number', description: 'finalized block height of BCH testnet'})
      ;
  }, async (argv) => {
    await startRescan(argv.height);
  })
  .command('pause', 'pause CC system by monitor', (yargs) => {
    return yargs;
  }, async (argv) => {
    await pause();
  })
  .command('resume', 'resume CC system by monitor', (yargs) => {
    return yargs;
  }, async (argv) => {
    await resume();
  })
  .command('handle-utxos', 'request CC system to handle UTXOs', (yargs) => {
    return yargs;
  }, async (argv) => {
    await handleUTXOs();
  })
  .command('redeem', 'redeem cc-UTXO', (yargs) => {
    return yargs
      .option('txid',  {required: true, type: 'string', description: 'txid of cc-UTXO'})
      .option('index', {required: true, type: 'number', description: 'vout of cc-UTXO'})
      .option('to',    {required: true, type: 'number', description: 'target address'})
      ;
  }, async (argv) => {
    await startRescan(argv.txid, argv.index, argv.to);
  })
  .strictCommands()
  .argv;

async function startRescan(h) {
  console.log('startRescan, h:', h);
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, ethers.getDefaultProvider());
  await ccc.startRescan(h);
}

async function pause() {
  console.log('pause ...');
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, ethers.getDefaultProvider());
  await ccc.pause();
}

async function resume() {
  console.log('resume ...');
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, ethers.getDefaultProvider());
  await ccc.resume();
}

async function handleUTXOs() {
  console.log('handleUTXOs ...');
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, ethers.getDefaultProvider());
  await ccc.handleUTXOs();
}

async function redeem(txid, idx, targetAddr) {
  console.log('redeem, txid:', txid, 'idx:', idx, 'targetAddr:', targetAddr);
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, ethers.getDefaultProvider());
  await ccc.redeem(txid, idx, targetAddr);
}
