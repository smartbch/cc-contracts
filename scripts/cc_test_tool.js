const yargs = require('yargs');
const hre = require("hardhat");

const ethers = hre.ethers;

const ccSysAddr = '0x0000000000000000000000000000000000002714';
const ccSysABI = [
  "function startRescan(uint256 mainFinalizedBlockHeight) external",
  "function pause() external",
  "function resume() external",
  "function handleUTXOs() external",
  "function redeem(uint256 txid, uint256 index, address targetAddress) external payable",
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
      .option('amount',{required: true, type: 'string', description: 'amount of cc-UTXO'})
      .option('to',    {required: true, type: 'string', description: 'target address'})
      ;
  }, async (argv) => {
    await redeem(argv.txid, argv.index, argv.amount, argv.to);
  })
  .strictCommands()
  .argv;

async function startRescan(h) {
  console.log('startRescan, h:', h);
  const signer = await ethers.getSigner();
  const bal = ethers.utils.formatUnits(await signer.getBalance());
  console.log('signer:', signer.address, 'balance:', bal);
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, signer);
  await cc.startRescan(h, {gasLimit: 2_000_000});
}

async function pause() {
  console.log('pause ...');
  const signer = await ethers.getSigner();
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, signer);
  await cc.pause();
}

async function resume() {
  console.log('resume ...');
  const signer = await ethers.getSigner();
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, signer);
  await cc.resume();
}

async function handleUTXOs() {
  console.log('handleUTXOs ...');
  const signer = await ethers.getSigner();
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, signer);
  await cc.handleUTXOs();
}

async function redeem(txid, idx, amt, targetAddr) {
  console.log('redeem, txid:', txid, 'idx:', idx, 'amt:', amt, 'targetAddr:', targetAddr);
  const signer = await ethers.getSigner();
  const bal = ethers.utils.formatUnits(await signer.getBalance());
  console.log('signer:', signer.address, 'balance:', bal);
  const cc = new ethers.Contract(ccSysAddr, ccSysABI, signer);
  await cc.redeem(txid, idx, targetAddr, {
    gasLimit: 8_000_000,
    value: ethers.utils.parseUnits(amt),
  });
}
