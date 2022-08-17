const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const zeroAddr = '0x0000000000000000000000000000000000000000';
const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const testPkX1     = ethers.utils.formatBytes32String('pubkey1');
const testPkX2     = ethers.utils.formatBytes32String('pubkey2');
const testPkX3     = ethers.utils.formatBytes32String('pubkey3');
const testPkX4     = ethers.utils.formatBytes32String('pubkey4');
const testPkX5     = ethers.utils.formatBytes32String('pubkey5');
const testRpcUrl1  = ethers.utils.formatBytes32String('rpcUrl1');
const testRpcUrl2  = ethers.utils.formatBytes32String('rpcUrl2');
const testRpcUrl3  = ethers.utils.formatBytes32String('rpcUrl3');
const testRpcUrl4  = ethers.utils.formatBytes32String('rpcUrl4');
const testRpcUrl5  = ethers.utils.formatBytes32String('rpcUrl5');
const testIntro1   = ethers.utils.formatBytes32String('intro11');
const testIntro2   = ethers.utils.formatBytes32String('intro22');
const testIntro3   = ethers.utils.formatBytes32String('intro33');
const testIntro4   = ethers.utils.formatBytes32String('intro44');
const testIntro5   = ethers.utils.formatBytes32String('intro55');
const [testPkX, testRpcUrl, testIntro] = [testPkX1, testRpcUrl1, testIntro1];


const minSelfStakeAmt = ethers.utils.parseUnits('10000');
const MIN_STAKE_PERIOD = 100 * 24 * 3600;

describe("CCOperatorsGov", function () {

  async function deployGov() {
    const [op1, op2, op3, op4, op5] = await ethers.getSigners();

    const OpsGov = await ethers.getContractFactory("CCOperatorsGovForUT");
    const gov = await OpsGov.deploy();

    return { gov, op1, op2, op3, op4, op5 };
  }

  it("applyOperator: invalid-pubkey-prefix", async () => {
    const { gov } = await loadFixture(deployGov);
    const testCases = [0x00, 0x01, 0x04, 0x05, 0x09, 0x99, 0xff];
    for (const x of testCases) {
      await expect(gov.applyOperator(x, testPkX, testRpcUrl, testIntro))
        .to.be.revertedWith("invalid-pubkey-prefix");
    }
  });

  it("applyOperator: deposit-too-less", async () => {
    const { gov } = await loadFixture(deployGov);
    const testCases = [0, 1, 123, minSelfStakeAmt.sub(1)];
    for (const x of testCases) {
      await expect(gov.applyOperator(0x02, testPkX, testRpcUrl, testIntro, {value: x}))
          .to.be.revertedWith("deposit-too-less");
    }
  });

  it("applyOperator: operator-existed", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    for (const op of [op1, op2, op3]) {
      await gov.connect(op).applyOperator(0x02, testPkX, testRpcUrl, testIntro, {value: minSelfStakeAmt});
      await expect(gov.connect(op).applyOperator(0x02, testPkX, testRpcUrl, testIntro, {value: minSelfStakeAmt.add(1)}))
          .to.be.revertedWith("operator-existed");
    }
  });

  it("applyOperator: ok", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);

    await expect(gov.connect(op1).applyOperator(0x02, testPkX1, testRpcUrl1, testIntro1, {value: minSelfStakeAmt.add(1)}))
        .to.emit(gov, 'OperatorApply').withArgs(op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1))
        .to.emit(gov, 'OperatorStake').withArgs(op1.address, op1.address, 0, minSelfStakeAmt.add(1));;

    await expect(gov.connect(op2).applyOperator(0x03, testPkX2, testRpcUrl2, testIntro2, {value: minSelfStakeAmt.add(2)}))
        .to.emit(gov, 'OperatorApply').withArgs(op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(2))
        .to.emit(gov, 'OperatorStake').withArgs(op2.address, op2.address, 1, minSelfStakeAmt.add(2));

    await expect(gov.connect(op3).applyOperator(0x02, testPkX3, testRpcUrl3, testIntro3, {value: minSelfStakeAmt.add(3)}))
        .to.emit(gov, 'OperatorApply').withArgs(op3.address, 0x02, testPkX3, testRpcUrl3, testIntro3, minSelfStakeAmt.add(3))
        .to.emit(gov, 'OperatorStake').withArgs(op3.address, op3.address, 2, minSelfStakeAmt.add(3));

    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,        totalStakedAmt,    electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1), minSelfStakeAmt.add(1), 0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(2), minSelfStakeAmt.add(2), 0],
      [op3.address, 0x02, testPkX3, testRpcUrl3, testIntro3, minSelfStakeAmt.add(3), minSelfStakeAmt.add(3), 0],
    ]);

    expect(await getAllStakeInfos(gov)).to.deep.equal([
      // staker,     operator,       stakedAmt,         stakedTimeGT0
      [op1.address, op1.address, minSelfStakeAmt.add(1), true],
      [op2.address, op2.address, minSelfStakeAmt.add(2), true],
      [op3.address, op3.address, minSelfStakeAmt.add(3), true],
    ]);
  });

  it("stake: errors", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    await gov.connect(op1).applyOperator(0x02, testPkX1, testRpcUrl1, testIntro1,
      {value: minSelfStakeAmt.add(1)});

    await expect(gov.connect(op3).stakeOperator(op1.address))
          .to.be.revertedWith("deposit-nothing");
    await expect(gov.connect(op2).stakeOperator(op2.address, {value: 123}))
          .to.be.revertedWith("no-such-operator");
    await expect(gov.connect(op1).stakeOperator(op3.address, {value: 123}))
          .to.be.revertedWith("no-such-operator");
  });

  it("unstake: errors", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    await gov.connect(op1).applyOperator(0x02, testPkX1, testRpcUrl1, testIntro1,
      {value: minSelfStakeAmt.add(1)});                              // stake#0
    await gov.connect(op2).stakeOperator(op1.address, {value: 123}); // stake#1
    await gov.connect(op3).stakeOperator(op1.address, {value: 456}); // stake#2

    await expect(gov.connect(op1).unstakeOperator(123, 456))
          .to.be.revertedWith("no-such-stake-info");
    await expect(gov.connect(op2).unstakeOperator(2, 456))
          .to.be.revertedWith("not-your-stake");
    await expect(gov.connect(op2).unstakeOperator(1, 456))
          .to.be.revertedWith("withdraw-too-much");
    await expect(gov.connect(op2).unstakeOperator(1, 100))
          .to.be.revertedWith("not-mature");

    await gov.setElectedTime(0, 123456789);
    await time.increase(MIN_STAKE_PERIOD + 1);
    await expect(gov.connect(op1).unstakeOperator(0, 456))
          .to.be.revertedWith("too-less-self-stake");
  });

  it("stake: ok", async () => {
    const { gov, op1, op2, op3, op4, op5 } = await loadFixture(deployGov);

    // stake#0,1
    await gov.connect(op1).applyOperator(0x02, testPkX1, testRpcUrl1, testIntro1, {value: minSelfStakeAmt.add(1)});
    await gov.connect(op2).applyOperator(0x03, testPkX2, testRpcUrl2, testIntro2, {value: minSelfStakeAmt.add(2)});

    // stake#2,3,4
    await expect(gov.connect(op3).stakeOperator(op1.address, {value: 100}))
        .to.emit(gov, 'OperatorStake').withArgs(op1.address, op3.address, 2, 100);
    await expect(gov.connect(op3).stakeOperator(op2.address, {value: 200}))
        .to.emit(gov, 'OperatorStake').withArgs(op2.address, op3.address, 3, 200);
    await expect(gov.connect(op4).stakeOperator(op1.address, {value: 300}))
        .to.emit(gov, 'OperatorStake').withArgs(op1.address, op4.address, 4, 300);

    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,        totalStakedAmt,    electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1), minSelfStakeAmt.add(401), 0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(2), minSelfStakeAmt.add(202), 0],
    ]);

    expect(await getAllStakeInfos(gov)).to.deep.equal([
      // staker,     operator,       stakedAmt,         stakedTimeGT0
      [op1.address, op1.address, minSelfStakeAmt.add(1), true],
      [op2.address, op2.address, minSelfStakeAmt.add(2), true],
      [op3.address, op1.address,                    100, true],
      [op3.address, op2.address,                    200, true],
      [op4.address, op1.address,                    300, true],
    ]);
  });

  it("unstake: ok", async () => {
    const { gov, op1, op2, op3, op4, op5 } = await loadFixture(deployGov);

    // stake#0,1
    await gov.connect(op1).applyOperator(0x02, testPkX1, testRpcUrl1, testIntro1, {value: minSelfStakeAmt.add(1)});
    await gov.connect(op2).applyOperator(0x03, testPkX2, testRpcUrl2, testIntro2, {value: minSelfStakeAmt.add(2)});

    // stake#2,3,4,5
    await gov.connect(op2).stakeOperator(op2.address, {value: 200});
    await gov.connect(op3).stakeOperator(op2.address, {value: 300});
    await gov.connect(op4).stakeOperator(op2.address, {value: 400});
    await gov.connect(op5).stakeOperator(op2.address, {value: 500});

    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,          totalStakedAmt,    electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1),   minSelfStakeAmt.add(1),    0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(202), minSelfStakeAmt.add(1402), 0],
    ]);
    expect(await getAllStakeInfos(gov)).to.deep.equal([
      // staker,     operator,       stakedAmt,         stakedTimeGT0
      [op1.address, op1.address, minSelfStakeAmt.add(1), true],
      [op2.address, op2.address, minSelfStakeAmt.add(2), true],
      [op2.address, op2.address,                    200, true],
      [op3.address, op2.address,                    300, true],
      [op4.address, op2.address,                    400, true],
      [op5.address, op2.address,                    500, true],
    ]);

    await time.increase(MIN_STAKE_PERIOD + 1);
    await expect(gov.connect(op2).unstakeOperator(2, 100))
        .to.emit(gov, 'OperatorUnstake').withArgs(op2.address, op2.address, 2, 100);
    await expect(gov.connect(op4).unstakeOperator(4, 150))
        .to.emit(gov, 'OperatorUnstake').withArgs(op2.address, op4.address, 4, 150);
    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,          totalStakedAmt,    electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1),   minSelfStakeAmt.add(1),    0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(102), minSelfStakeAmt.add(1152), 0],
    ]);
    expect(await getAllStakeInfos(gov)).to.deep.equal([
      // staker,     operator,       stakedAmt,         stakedTimeGT0
      [op1.address, op1.address, minSelfStakeAmt.add(1), true],
      [op2.address, op2.address, minSelfStakeAmt.add(2), true],
      [op2.address, op2.address,                    100, true],
      [op3.address, op2.address,                    300, true],
      [op4.address, op2.address,                    250, true],
      [op5.address, op2.address,                    500, true],
    ]);

    await expect(gov.connect(op2).unstakeOperator(2, 100))
        .to.emit(gov, 'OperatorUnstake').withArgs(op2.address, op2.address, 2, 100);
    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,        totalStakedAmt,    electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1), minSelfStakeAmt.add(1),    0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(2), minSelfStakeAmt.add(1052), 0],
    ]);
    expect(await getAllStakeInfos(gov)).to.deep.equal([
      // staker,     operator,       stakedAmt,         stakedTimeGT0
      [op1.address, op1.address, minSelfStakeAmt.add(1), true],
      [op2.address, op2.address, minSelfStakeAmt.add(2), true],
      [zeroAddr,    zeroAddr,                         0,false],
      [op3.address, op2.address,                    300, true],
      [op4.address, op2.address,                    250, true],
      [op5.address, op2.address,                    500, true],
    ]);
  });

  it("stake/unstake: operator slots", async () => {
    const { gov, op1, op2, op3, op4, op5 } = await loadFixture(deployGov);

    await gov.connect(op1).applyOperator(0x02, testPkX1, testRpcUrl1, testIntro1, {value: minSelfStakeAmt.add(1)});
    await gov.connect(op2).applyOperator(0x03, testPkX2, testRpcUrl2, testIntro2, {value: minSelfStakeAmt.add(2)});
    await gov.connect(op3).applyOperator(0x02, testPkX3, testRpcUrl3, testIntro3, {value: minSelfStakeAmt.add(3)});
    await gov.connect(op4).applyOperator(0x03, testPkX4, testRpcUrl4, testIntro4, {value: minSelfStakeAmt.add(4)});
    await gov.connect(op5).applyOperator(0x02, testPkX5, testRpcUrl5, testIntro5, {value: minSelfStakeAmt.add(5)});
    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,         totalStakedAmt,  electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1), minSelfStakeAmt.add(1), 0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(2), minSelfStakeAmt.add(2), 0],
      [op3.address, 0x02, testPkX3, testRpcUrl3, testIntro3, minSelfStakeAmt.add(3), minSelfStakeAmt.add(3), 0],
      [op4.address, 0x03, testPkX4, testRpcUrl4, testIntro4, minSelfStakeAmt.add(4), minSelfStakeAmt.add(4), 0],
      [op5.address, 0x02, testPkX5, testRpcUrl5, testIntro5, minSelfStakeAmt.add(5), minSelfStakeAmt.add(5), 0],
    ]);

    await time.increase(MIN_STAKE_PERIOD + 1);
    await gov.connect(op2).unstakeOperator(1, minSelfStakeAmt.add(2));
    await gov.connect(op4).unstakeOperator(3, minSelfStakeAmt.add(4));
    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,         totalStakedAmt,  electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1), minSelfStakeAmt.add(1), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32, zeroBytes32,                 0,                      0,  0],
      [op3.address, 0x02, testPkX3, testRpcUrl3, testIntro3, minSelfStakeAmt.add(3), minSelfStakeAmt.add(3), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32, zeroBytes32,                 0,                      0,  0],
      [op5.address, 0x02, testPkX5, testRpcUrl5, testIntro5, minSelfStakeAmt.add(5), minSelfStakeAmt.add(5), 0],
    ]);

    await gov.connect(op2).applyOperator(0x03, testPkX2, testRpcUrl2, testIntro2, {value: minSelfStakeAmt.add(7)});
    await gov.connect(op4).applyOperator(0x03, testPkX4, testRpcUrl4, testIntro4, {value: minSelfStakeAmt.add(6)});
    expect(await getAllOperatorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX, rpcUrl,      intro,      selfStakedAmt,         totalStakedAmt,  electedTime
      [op1.address, 0x02, testPkX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1), minSelfStakeAmt.add(1), 0],
      [op4.address, 0x03, testPkX4, testRpcUrl4, testIntro4, minSelfStakeAmt.add(6), minSelfStakeAmt.add(6), 0],
      [op3.address, 0x02, testPkX3, testRpcUrl3, testIntro3, minSelfStakeAmt.add(3), minSelfStakeAmt.add(3), 0],
      [op2.address, 0x03, testPkX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(7), minSelfStakeAmt.add(7), 0],
      [op5.address, 0x02, testPkX5, testRpcUrl5, testIntro5, minSelfStakeAmt.add(5), minSelfStakeAmt.add(5), 0],
    ]);
  });

});

async function getAllOperatorInfos(gov) {
  const ops = [];
  for (let i = 0; ; i++) {
    try {
      ops.push(await getOperatorInfo(gov, i));
    } catch (err) {
      // console.log(err);
      break;
    }
  }
  return ops;
}
async function getOperatorInfo(gov, idx) {
  // return await gov.operators(idx);
  let [addr, pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, electedTime] = await gov.operators(idx);
  // totalStakedAmt = ethers.utils.formatUnits(totalStakedAmt);
  // selfStakedAmt = ethers.utils.formatUnits(selfStakedAmt);
  // pubkeyPrefix = pubkeyPrefix.toNumber();
  electedTime = electedTime.toNumber();
  return [addr, pubkeyPrefix, pubkeyX, rpcUrl, intro, selfStakedAmt, totalStakedAmt, electedTime];
}

async function getAllStakeInfos(gov) {
  const infos = [];
  for (let i = 0; ; i++) {
    try {
      infos.push(await getStakeInfo(gov, i));
    } catch (err) {
      // console.log(err);
      break;
    }
  }
  return infos;
}
async function getStakeInfo(gov, idx) {
  // return await gov.stakeInfos(idx);
  let [staker, operator, stakedTime, stakedAmt] = await gov.stakeInfos(idx);
  let stakedTimeGT0 = stakedTime > 0;
  return [staker, operator, stakedAmt, stakedTimeGT0];
}
