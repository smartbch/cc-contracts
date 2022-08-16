const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const testPubKeyX1 = ethers.utils.formatBytes32String('pubkey1');
const testPubKeyX2 = ethers.utils.formatBytes32String('pubkey2');
const testPubKeyX3 = ethers.utils.formatBytes32String('pubkey3');
const testRpcUrl1  = ethers.utils.formatBytes32String('rpcUrl1');
const testRpcUrl2  = ethers.utils.formatBytes32String('rpcUrl2');
const testRpcUrl3  = ethers.utils.formatBytes32String('rpcUrl3');
const testIntro1   = ethers.utils.formatBytes32String('intro11');
const testIntro2   = ethers.utils.formatBytes32String('intro22');
const testIntro3   = ethers.utils.formatBytes32String('intro33');
const [testPubKeyX, testRpcUrl, testIntro] = [testPubKeyX1, testRpcUrl1, testIntro1];


const minSelfStakeAmt = ethers.utils.parseUnits('10000');
const MIN_STAKE_PERIOD = 100 * 24 * 3600;

describe("CCOperatorsGov", function () {

  async function deployGov() {
    const [op1, op2, op3] = await ethers.getSigners();

    const OpsGov = await ethers.getContractFactory("CCOperatorsGovForUT");
    const gov = await OpsGov.deploy();

    return { gov, op1, op2, op3 };
  }

  it("applyOperator: invalid-pubkey-prefix", async () => {
    const { gov } = await loadFixture(deployGov);
    const testCases = [0x00, 0x01, 0x04, 0x05, 0x09, 0x99, 0xff];
    for (const x of testCases) {
      await expect(gov.applyOperator(x, testPubKeyX, testRpcUrl, testIntro))
        .to.be.revertedWith("invalid-pubkey-prefix");
    }
  });

  it("applyOperator: deposit-too-less", async () => {
    const { gov } = await loadFixture(deployGov);
    const testCases = [0, 1, 123, minSelfStakeAmt.sub(1)];
    for (const x of testCases) {
      await expect(gov.applyOperator(0x02, testPubKeyX, testRpcUrl, testIntro, {value: x}))
          .to.be.revertedWith("deposit-too-less");
    }
  });

  it("applyOperator: operator-existed", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    for (const op of [op1, op2, op3]) {
      await gov.connect(op).applyOperator(0x02, testPubKeyX, testRpcUrl, testIntro, {value: minSelfStakeAmt});
      await expect(gov.connect(op).applyOperator(0x02, testPubKeyX, testRpcUrl, testIntro, {value: minSelfStakeAmt.add(1)}))
          .to.be.revertedWith("operator-existed");
    }
  });

  it("applyOperator: ok", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);

    await expect(gov.connect(op1).applyOperator(0x02, testPubKeyX1, testRpcUrl1, testIntro1, {value: minSelfStakeAmt.add(1)}))
        .to.emit(gov, 'OperatorApply').withArgs(op1.address, 0x02, testPubKeyX1, testRpcUrl1, testIntro1, minSelfStakeAmt.add(1))
        .to.emit(gov, 'OperatorStake').withArgs(op1.address, op1.address, 0, minSelfStakeAmt.add(1));;

    await expect(gov.connect(op2).applyOperator(0x03, testPubKeyX2, testRpcUrl2, testIntro2, {value: minSelfStakeAmt.add(2)}))
        .to.emit(gov, 'OperatorApply').withArgs(op2.address, 0x03, testPubKeyX2, testRpcUrl2, testIntro2, minSelfStakeAmt.add(2))
        .to.emit(gov, 'OperatorStake').withArgs(op2.address, op2.address, 1, minSelfStakeAmt.add(2));

    await expect(gov.connect(op3).applyOperator(0x02, testPubKeyX3, testRpcUrl3, testIntro3, {value: minSelfStakeAmt.add(3)}))
        .to.emit(gov, 'OperatorApply').withArgs(op3.address, 0x02, testPubKeyX3, testRpcUrl3, testIntro3, minSelfStakeAmt.add(3))
        .to.emit(gov, 'OperatorStake').withArgs(op3.address, op3.address, 2, minSelfStakeAmt.add(3));

    const ops = await getAllOperatorInfos(gov);
    expect(ops.map(op => op.addr))          .to.deep.equal([op1.address, op2.address, op3.address]);
    expect(ops.map(op => op.pubkeyPrefix))  .to.deep.equal([0x02, 0x03, 0x02]);
    expect(ops.map(op => op.pubkeyX))       .to.deep.equal([testPubKeyX1, testPubKeyX2, testPubKeyX3]);
    expect(ops.map(op => op.rpcUrl))        .to.deep.equal([testRpcUrl1, testRpcUrl2, testRpcUrl3]);
    expect(ops.map(op => op.totalStakedAmt)).to.deep.equal([minSelfStakeAmt.add(1), minSelfStakeAmt.add(2), minSelfStakeAmt.add(3)]);
    expect(ops.map(op => op.selfStakedAmt)) .to.deep.equal([minSelfStakeAmt.add(1), minSelfStakeAmt.add(2), minSelfStakeAmt.add(3)]);
    expect(ops.map(op => op.electedTime))   .to.deep.equal([0, 0, 0]);

    const stakeInfos = await getAllStakeInfos(gov);
    expect(stakeInfos.map(x => x.staker))   .to.deep.equal([op1.address, op2.address, op3.address]);
    expect(stakeInfos.map(x => x.operator)) .to.deep.equal([op1.address, op2.address, op3.address]);
    expect(stakeInfos.map(x => x.stakedAmt)).to.deep.equal([minSelfStakeAmt.add(1), minSelfStakeAmt.add(2), minSelfStakeAmt.add(3)]);
    expect(stakeInfos.map(x => x.stakedTime > 0)).to.deep.equal([true, true, true]);
  });

  it("stake: errors", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    await gov.connect(op1).applyOperator(0x02, testPubKeyX1, testRpcUrl1, testIntro1,
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
    await gov.connect(op1).applyOperator(0x02, testPubKeyX1, testRpcUrl1, testIntro1,
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

  it("stake/unstake: ok", async () => {
    // TODO
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
  return await gov.operators(idx);
  // let [addr, pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, electedTime] = await gov.operators(idx);
  // // totalStakedAmt = ethers.utils.formatUnits(totalStakedAmt);
  // // selfStakedAmt = ethers.utils.formatUnits(selfStakedAmt);
  // electedTime = electedTime.toNumber();
  // return [addr, pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, electedTime];
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
  return await gov.stakeInfos(idx);
  // let [staker, operator, stakedTime, stakedAmt] = await gov.stakeInfos(idx);
  // return [staker, operator, stakedTime, stakedAmt];
}
