const hre = require("hardhat");

const ethers = hre.ethers;

const sep206Addr = '0x0000000000000000000000000000000000002711';
const erc20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

let signer;
let ccOperatorsGov;
let ccMonitorsGov;
let ccSbchNodesGov;

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  signer = await ethers.getSigner();
  const bal = ethers.utils.formatUnits(await signer.getBalance());
  console.log('signer:', signer.address, 'balance:', bal);

  await deployGovContracts();
  await initGovContracts();
}

async function deployGovContracts() {  
  console.log('deploy Gov contracts ...');

  // deploy CCOperatorsGov
  const CCOperatorsGov = await ethers.getContractFactory("CCOperatorsGov");
  ccOperatorsGov = await CCOperatorsGov.deploy();
  await ccOperatorsGov.deployed();
  const ccOperatorsSeq = await ccOperatorsGov.provider.send('debug_getSeq', [ccOperatorsGov.address]);
  console.log("CCOperatorsGov deployed to:", ccOperatorsGov.address, "SEQ:", ccOperatorsSeq);

  // deploy CCMonitorsGov
  const CCMonitorsGov = await ethers.getContractFactory("CCMonitorsGov");
  ccMonitorsGov = await CCMonitorsGov.deploy(ccOperatorsGov.address);
  await ccMonitorsGov.deployed();
  const ccMonitorsSeq = await ccMonitorsGov.provider.send('debug_getSeq', [ccMonitorsGov.address]);
  console.log("CCMonitorsGov  deployed to:", ccMonitorsGov.address, "SEQ:", ccMonitorsSeq);

  // deploy CCSbchNodesGov
  const CCSbchNodesGov = await ethers.getContractFactory("CCSbchNodesGov");
  ccSbchNodesGov = await CCSbchNodesGov.deploy(ccMonitorsGov.address, ccOperatorsGov.address, [signer.address]);
  await ccSbchNodesGov.deployed();
  console.log("CCSbchNodesGov deployed to:", ccSbchNodesGov.address);
}

async function initGovContracts() {
  const mos = [
    {
      wallet        : wifToWallet('L4GUc8432jgYMVxa1UhF1UC9Mxer5N7exdhbVLugZgWsR29U2pcw'),
      addr          : '0x',
      pubkeyPrefix  : 0x02,
      pubkeyX       : '0x4a899d685daf6b1999a5c8f2fd3c9ed640d58e92fd0e00cf87cacee8ff1504b8',
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-mo1'),
      stakedAmt     : ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
      nominatedBy   : [],
    },
    {
      wallet        : wifToWallet('Kxr5EpWHx2WB5TKXRqqZVPNnEqB7zisXaRS6QgVTMGogzua9JFjP'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0x74ac9ab3415253dbb7e29f46a69a3e51b5d2d66f125b0c9f2dc990b1d2e87e17',
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-mo2'),
      stakedAmt     : ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
      nominatedBy   : [],
    },
    {
      wallet        : wifToWallet('L2M9cNJ7oQeHMnBVFyDZPhGAGNB3v6swcX1xRiYUPj7Fpcjnv3UV'),
      addr          : '0x',
      pubkeyPrefix  : 0x02,
      pubkeyX       : '0x4cc911ba9d2c7806a217774618b7ba4848ccd33fe664414fc3144d144cdebf7b',
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-mo3'),
      stakedAmt     : ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
      nominatedBy   : [],
    },
  ];

  const ops = [
    {
      wallet        : wifToWallet('L482yD31EhZopxRD3V19QEANQaYkcUZfgNKYY2TV4RTCXa6izAKo'),
      addr          : '0x',
      pubkeyPrefix  : 0x02,
      pubkeyX       : '0xd86b49e3424e557beebf67bd06842cdb88e314c44887f3f265b7f81107dd6994',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8801'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op1'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L4JzvBMUmkQCTdz2zbVgTyW8dDMvMU8HFwe413qfnBxW3vKSw6sm'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0x5c0a0cb8987290ea0a7a926e8aa8978ac042b4c0be8553eb4422461ce1a17cd8',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8802'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op2'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L3vi8Z3HJUQw3iXcgRkbcPVku6R1XA2V6iLCG6NeuqRTvt4mUV6K'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0xfdec69ef6ec640264045229ca7cf0f170927b87fc8d2047844f8a766ead467e4',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8803'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op3'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L5mXQBYy1nKMTxXA3LmvUVH9pfBeaKzCKiYNszkj88s2vQEocyUs'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0x8fd3d33474e1bd453614f85d8fb1edecae92255867d18a9048669119fb710af5',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8804'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op4'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L15emxZt9yyY6ZxxRGvKRm72CMZaCRDKbSRmdRwu5h2wCUGdfwwb'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0x94ec324d59305638ead14b4f4da9a50c793f1e328e180f92c04a4990bb573af1',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8805'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op5'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L5X85r9Bbf86jyf4wSRXxttPwWmkcGcv2tHhZ9eD6YiNZnZcPqZX'),
      addr          : '0x',
      pubkeyPrefix  : 0x02,
      pubkeyX       : '0x71ea0c254ebbb7ed78668ba8653abe222b9f7177642d3a75709d95912a8d9d2c',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8806'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op6'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L3HPpfMVSmYN9Y3tVJT2UorzNyWjZEQMHHuJmZKnwAGpudpA1o93'),
      addr          : '0x',
      pubkeyPrefix  : 0x02,
      pubkeyX       : '0xfbbc3870035c2ee30cfa3102aff15e58bdfc0d0f95998cd7e1eeebc09cdb6873',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8807'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op7'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('L44W5cEBFAY4kcSm5q7ch8Ko3AsXV1MfJDDq1oq1u797EkhutH8s'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0x86f450b1bee3b220c6a9a25515f15f05bd80a23e5f707873dfbac52db933b27d',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8808'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op8'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('KxnPxfZ3VJtdfJm7dk1g4PeHJWz9BqRJwk6wfdNMTqeUiJJRphzD'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0xbfe6f6ecb5e10662481aeb6f6408db2a32b9b86a660acbb8c5374dbb976e53ca',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8809'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op9'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
    {
      wallet        : wifToWallet('KzPnubj5tnS8efj2nApUK3wnsHCKAS6khHYxPCaciT474mNs6vfJ'),
      addr          : '0x',
      pubkeyPrefix  : 0x03,
      pubkeyX       : '0x883b732620e238e74041e5fab900234dc80f7a48d56a1bf41e8523c4661f8243',
      rpcUrl        : ethers.utils.formatBytes32String('https://3.1.26.210:8810'),
      intro         : ethers.utils.formatBytes32String('shagate2-testnet1-op0'),
      selfStakedAmt : ethers.utils.parseUnits('0.1'),
      totalStakedAmt: ethers.utils.parseUnits('0.1'),
      electedTime   : 0,
      oldElectedTime: 0,
    },
  ];

  const sep206 = new ethers.Contract(sep206Addr, erc20ABI, signer);

  // send monitors and operators some sBCH
  const amt = ethers.utils.parseUnits('0.11');
  console.log('funding monitors ...');
  for (let mo of mos) {
    console.log(mo.wallet.address);
    // await signer.sendTransaction({to: mo.addr, value: amt});
    await sep206.connect(mo.wallet).approve(ccMonitorsGov.address, amt);
  }
  console.log('funding operators ...');
  for (let op of ops) {
    console.log(op.wallet.address);
    // await signer.sendTransaction({to: op.addr, value: amt});
    await sep206.connect(op.wallet).approve(ccOperatorsGov.address, amt);
  }

  for (let mo of mos) { mo.addr = mo.wallet.address; delete mo.wallet; }
  for (let op of ops) { op.addr = op.wallet.address; delete op.wallet; }

  console.log('init MonitorsGov ...');
  await ccMonitorsGov.init(mos);
  console.log('init OperatorsGov ...');
  await ccOperatorsGov.init(ops);
}

// https://learnmeabitcoin.com/technical/wif
function wifToWallet(wif) {
  const base58decoded = Buffer.from(ethers.utils.base58.decode(wif)).toString('hex');
  const privKey = base58decoded.slice(2, base58decoded.length - 10);
  const wallet = new ethers.Wallet(privKey, signer.provider);
  // console.log(wif);
  // console.log(privKey);
  // console.log(wallet.address);
  return wallet;
}
