const yargs = require('yargs');
const hre = require("hardhat");

const ethers = hre.ethers;

yargs(process.argv.slice(2))
  .command('list-operators', 'list all operators info', (yargs) => {
    return yargs
      .option('gov', {required: true, type: 'string', description: 'OperatorsGov address'})
      ;
  }, async (argv) => {
    await listOperators(argv.gov);
  })
  .command('list-monitors', 'list all monitors info', (yargs) => {
    return yargs
      .option('gov', {required: true, type: 'string', description: 'MonitorsGov address'})
      ;
  }, async (argv) => {
    await listMonitors(argv.gov);
  })
  .command('list-sbchd-nodes', 'list all sbchd nodes', (yargs) => {
    return yargs
      .option('gov', {required: true, type: 'string', description: 'SbchNodesGov address'})
      ;
  }, async (argv) => {
    await listSbchdNodes(argv.gov);
  })
  .strictCommands()
  .argv;


async function listOperators(govAddr) {
  console.log('listOperators, govAddr:', govAddr, '\n');

  const Gov = await ethers.getContractFactory("CCOperatorsGov");
  const gov = Gov.attach(govAddr);

  for (let i = 0; ; i++) {
    try {
      const operator = await gov.operators(i);
      console.log('operator      :', i);
      console.log('addr          :', operator.addr);
      console.log('pubkey        :', '0x0' + operator.pubkeyPrefix + operator.pubkeyX.replace('0x', ''));
      console.log('rpcUrl        :', ethers.utils.parseBytes32String(operator.rpcUrl));
      console.log('intro         :', ethers.utils.parseBytes32String(operator.intro));
      console.log('totalStakedAmt:', ethers.utils.formatUnits(operator.totalStakedAmt));
      console.log('selfStakedAmt :', ethers.utils.formatUnits(operator.selfStakedAmt));
      console.log('electedTime   :', operator.electedTime.toNumber());
    } catch (err) {
      break;
    }
  }
}

async function listMonitors(govAddr) {
  console.log('listMonitors, govAddr:', govAddr, '\n');

  const Gov = await ethers.getContractFactory("CCMonitorsGov");
  const gov = Gov.attach(govAddr);

  for (let i = 0; ; i++) {
    try {
      const monitor = await gov.monitors(i);
      console.log('monitor    :', i);
      console.log('addr       :', monitor.addr);
      console.log('pubkey     :', '0x0' + monitor.pubkeyPrefix + monitor.pubkeyX.replace('0x', ''));
      console.log('intro      :', ethers.utils.parseBytes32String(monitor.intro));
      console.log('stakedAmt  :', ethers.utils.formatUnits(monitor.stakedAmt));
      console.log('electedTime:', monitor.electedTime.toNumber());
    } catch (err) {
      break;
    }
  }
}

async function listSbchdNodes(govAddr) {
  console.log('listSbchdNodes, govAddr:', govAddr, '\n');

  const Gov = await ethers.getContractFactory("CCSbchNodesGov");
  const gov = Gov.attach(govAddr);

  const n = await gov.getNodeCount();
  for (let i = 0; i < n; i++) {
    try {
      let [id, pubkeyHash, rpcUrl, intro] = await gov.nodes(i);
      console.log('id     :', id.toNumber());
      console.log('pbkHash:', pubkeyHash);
      console.log('rpcUrl :', ethers.utils.parseBytes32String(rpcUrl));
      console.log('intro  :', ethers.utils.parseBytes32String(intro));
    } catch (err) {
      console.log(err);
      break;
    }
  }
}
