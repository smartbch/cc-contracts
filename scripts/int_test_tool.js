const yargs = require('yargs');
const hre = require("hardhat");

const ethers = hre.ethers;

yargs(process.argv.slice(2))
  .command('deploy-gov-contracts', 'deploy gov contracts', (yargs) => {
    return yargs;
  }, async (argv) => {
    await deployGovContracts();
  })
  .command('list-operators', 'list all operators info', (yargs) => {
    return yargs
      .option('gov', {required: true,  type: 'string', description: 'OperatorsGov address'})
      ;
  }, async (argv) => {
    await listOperators(argv.gov);
  })
  .command('list-monitors', 'list all operators info', (yargs) => {
    return yargs
      .option('gov', {required: true,  type: 'string', description: 'MonitorsGov address'})
      ;
  }, async (argv) => {
    await listMonitors(argv.gov);
  })
  .command('add-operator', 'add a new operator', (yargs) => {
    return yargs
      .option('gov',             {required: true,  type: 'string', description: 'OperatorsGov address'})
      .option('operator',        {required: true,  type: 'string', description: 'operator address'})
      .option('pubkey',          {required: true,  type: 'string', description: '33 bytes HEX string'})
      .option('total-staked-amt',{required: true,  type: 'number', description: 'total staked amt in BCH'})
      .option('self-staked-amt', {required: true,  type: 'number', description: 'self staked amt in BCH'})
      .option('elected-time',    {required: false, type: 'number', description: 'elected-time', default: 0})
      ;
  }, async (argv) => {
    await addOperator(argv.gov, argv.operator, argv.pubkey,
      ethers.utils.parseUnits(argv.totalStakedAmt.toString()), 
      ethers.utils.parseUnits(argv.selfStakedAmt.toString()),
      argv.electedTime);
  })
  .command('add-monitor', 'add a new monitor', (yargs) => {
    return yargs
      .option('gov',          {required: true,  type: 'string', description: 'MonitorsGov address'})
      .option('monitor',      {required: true,  type: 'string', description: 'monitor address'})
      .option('pubkey',       {required: true,  type: 'string', description: '33 bytes HEX string'})
      .option('staked-amt',   {required: true,  type: 'number', description: 'staked amt in BCH'})
      .option('elected-time', {required: false, type: 'number', description: 'elected-time', default: 0})
      ;
  }, async (argv) => {
    await addMonitor(argv.gov, argv.monitor, argv.pubkey,
      ethers.utils.parseUnits(argv.stakedAmt.toString()), 
      argv.electedTime);
  })
  .command('update-operator', 'update existed operator', (yargs) => {
    return yargs
      .option('gov',             {required: true,  type: 'string', description: 'OperatorsGov address'})
      .option('operator',        {required: true,  type: 'string', description: 'operator address'})
      .option('pubkey',          {required: true,  type: 'string', description: '33 bytes HEX string'})
      .option('total-staked-amt',{required: true,  type: 'number', description: 'total staked amt in BCH'})
      .option('self-staked-amt', {required: true,  type: 'number', description: 'self staked amt in BCH'})
      .option('elected-time',    {required: false, type: 'number', description: 'elected-time', default: 0})
      ;
  }, async (argv) => {
    await updateOperator(argv.gov, argv.operator, argv.pubkey,
      ethers.utils.parseUnits(argv.totalStakedAmt.toString()), 
      ethers.utils.parseUnits(argv.selfStakedAmt.toString()),
      argv.electedTime);
  })
  .command('update-monitor', 'update existed monitor', (yargs) => {
    return yargs
      .option('gov',          {required: true,  type: 'string', description: 'MonitorsGov address'})
      .option('monitor',      {required: true,  type: 'string', description: 'monitor address'})
      .option('pubkey',       {required: true,  type: 'string', description: '33 bytes HEX string'})
      .option('staked-amt',   {required: true,  type: 'number', description: 'staked amt in BCH'})
      .option('elected-time', {required: false, type: 'number', description: 'elected-time', default: 0})
      ;
  }, async (argv) => {
    await updateMonitor(argv.gov, argv.monitor, argv.pubkey,
      ethers.utils.parseUnits(argv.stakedAmt.toString()), 
      argv.electedTime);
  })
  .strictCommands()
  .argv;


async function deployGovContracts() {
  await hre.run("compile");

  // deploy CCMonitorsGov
  const CCMonitorsGov = await hre.ethers.getContractFactory("CCMonitorsGovForIntegrationTest");
  const ccMonitorsGov = await CCMonitorsGov.deploy();
  await ccMonitorsGov.deployed();
  const ccMonitorsSeq = await ccMonitorsGov.provider.send('debug_getSeq', [ccMonitorsGov.address]);
  console.log("CCMonitorsGov deployed to:", ccMonitorsGov.address, "SEQ:", ccMonitorsSeq);

  // deploy CCOperatorsGov
  const CCOperatorsGov = await hre.ethers.getContractFactory("CCOperatorsGovForIntegrationTest");
  const ccOperatorsGov = await CCOperatorsGov.deploy();
  await ccOperatorsGov.deployed();
  const ccOperatorsSeq = await ccOperatorsGov.provider.send('debug_getSeq', [ccOperatorsGov.address]);
  console.log("CCOperatorsGov deployed to:", ccOperatorsGov.address, "SEQ:", ccOperatorsSeq);
}


async function addOperator(govAddr,
                           operatorAddr,
                           pubkey,
                           totalStakedAmt,
                           selfStakedAmt,
                           electedTime) {
  console.log('addOperator ...');
  console.log('govAddr       :', govAddr);
  console.log('operatorAddr  :', operatorAddr);
  console.log('pubkey        :', pubkey);
  console.log('totalStakedAmt:', totalStakedAmt);
  console.log('selfStakedAmt :', selfStakedAmt);
  console.log('electedTime   :', electedTime);

  const rpcUrl = ethers.utils.formatBytes32String('rpc:'+operatorAddr.substring(0, 27));
  const intro = ethers.utils.formatBytes32String('intro:'+operatorAddr.substring(0, 25));

  const Gov = await hre.ethers.getContractFactory("CCOperatorsGovForIntegrationTest");
  const gov = Gov.attach(govAddr);
  const ret = await gov.addOperator(operatorAddr, pubkey, rpcUrl, intro, 
      totalStakedAmt, selfStakedAmt, electedTime)
  console.log(ret);
}

async function updateOperator(govAddr,
                              operatorAddr,
                              pubkey,
                              totalStakedAmt,
                              selfStakedAmt,
                              electedTime) {
  console.log('updateOperator ...');
  console.log('govAddr       :', govAddr);
  console.log('operatorAddr  :', operatorAddr);
  console.log('pubkey        :', pubkey);
  console.log('totalStakedAmt:', totalStakedAmt);
  console.log('selfStakedAmt :', selfStakedAmt);
  console.log('electedTime   :', electedTime);

  const Gov = await hre.ethers.getContractFactory("CCOperatorsGovForIntegrationTest");
  const gov = Gov.attach(govAddr);
  const ret = await gov.updateOperator(operatorAddr, pubkey, 
      totalStakedAmt, selfStakedAmt, electedTime)
  console.log(ret);
}

async function listOperators(govAddr) {
  console.log('listOperators, govAddr:', govAddr, '\n');

  const Gov = await hre.ethers.getContractFactory("CCOperatorsGovForIntegrationTest");
  const gov = Gov.attach(govAddr);

  for (let i = 0; ; i++) {
    try {
      const operator = await gov.operators(i);
      console.log('operator      :', i);
      console.log('addr          :', operator.addr);
      console.log('pubkey        :', '0x0' + operator.pubkeyPrefix + operator.pubkeyX.replace('0x', ''));
      console.log('totalStakedAmt:', ethers.utils.formatUnits(operator.totalStakedAmt));
      console.log('selfStakedAmt :', ethers.utils.formatUnits(operator.selfStakedAmt));
      console.log('electedTime   :', operator.electedTime.toNumber());
    } catch (err) {
      break;
    }
  }
}


async function addMonitor(govAddr,
                          monitorAddr,
                          pubkey,
                          stakedAmt,
                          electedTime) {
  console.log('addMonitor ...');
  console.log('govAddr    :', govAddr);
  console.log('monitorAddr:', monitorAddr);
  console.log('pubkey     :', pubkey);
  console.log('stakedAmt  :', stakedAmt);
  console.log('electedTime:', electedTime);

  const intro = ethers.utils.formatBytes32String('intro:'+monitorAddr.substring(0, 25));

  const Gov = await hre.ethers.getContractFactory("CCMonitorsGovForIntegrationTest");
  const gov = Gov.attach(govAddr);
  const ret = await gov.addMonitor(monitorAddr, pubkey, intro, stakedAmt, electedTime)
  console.log(ret);
}

async function updateMonitor(govAddr,
                             monitorAddr,
                             pubkey,
                             stakedAmt,
                             electedTime) {
  console.log('updateMonitor ...');
  console.log('govAddr    :', govAddr);
  console.log('monitorAddr:', monitorAddr);
  console.log('pubkey     :', pubkey);
  console.log('stakedAmt  :', stakedAmt);
  console.log('electedTime:', electedTime);

  const Gov = await hre.ethers.getContractFactory("CCMonitorsGovForIntegrationTest");
  const gov = Gov.attach(govAddr);
  const ret = await gov.updateMonitor(monitorAddr, pubkey, stakedAmt, electedTime)
  console.log(ret);
}

async function listMonitors(govAddr) {
  console.log('listMonitors, govAddr:', govAddr, '\n');

  const Gov = await hre.ethers.getContractFactory("CCMonitorsGovForIntegrationTest");
  const gov = Gov.attach(govAddr);

  for (let i = 0; ; i++) {
    try {
      const monitor = await gov.monitors(i);
      console.log('monitor    :', i);
      console.log('addr       :', monitor.addr);
      console.log('pubkey     :', '0x0' + monitor.pubkeyPrefix + monitor.pubkeyX.replace('0x', ''));
      console.log('stakedAmt  :', ethers.utils.formatUnits(monitor.stakedAmt));
      console.log('electedTime:', monitor.electedTime.toNumber());
    } catch (err) {
      break;
    }
  }
}
