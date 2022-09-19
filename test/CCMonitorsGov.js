const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const zeroAddr = '0x0000000000000000000000000000000000000000';
const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const testPkX1   = ethers.utils.formatBytes32String('pubkey1');
const testPkX2   = ethers.utils.formatBytes32String('pubkey2');
const testPkX3   = ethers.utils.formatBytes32String('pubkey3');
const testPkX4   = ethers.utils.formatBytes32String('pubkey4');
const testPkX5   = ethers.utils.formatBytes32String('pubkey5');
const testPkX6   = ethers.utils.formatBytes32String('pubkey6');
const testIntro1 = ethers.utils.formatBytes32String('intro11');
const testIntro2 = ethers.utils.formatBytes32String('intro22');
const testIntro3 = ethers.utils.formatBytes32String('intro33');
const testIntro4 = ethers.utils.formatBytes32String('intro44');
const testIntro5 = ethers.utils.formatBytes32String('intro55');
const testIntro6 = ethers.utils.formatBytes32String('intro66');
const [testPkX, testIntro] = [testPkX1, testIntro1];


const minStakedAmt = ethers.utils.parseUnits('100000');

describe("CCMonitorsGov", function () {

  async function deployGov() {
    const [op1, op2, op3, op4, op5, op6] = await ethers.getSigners();

    const OpsGov = await ethers.getContractFactory("CCMonitorsGovForUT");
    const gov = await OpsGov.deploy();

    return { gov, op1, op2, op3, op4, op5, op6 };
  }

  it("applyMonitor: invalid-pubkey-prefix", async () => {
    const { gov } = await loadFixture(deployGov);
    const testCases = [0x00, 0x01, 0x04, 0x05, 0x09, 0x99, 0xff];
    for (const x of testCases) {
      await expect(gov.applyMonitor(x, testPkX, testIntro))
        .to.be.revertedWith("invalid-pubkey-prefix");
    }
  });

  it("applyMonitor: deposit-too-less", async () => {
    const { gov } = await loadFixture(deployGov);
    const testCases = [0, 1, 123, minStakedAmt.sub(1)];
    for (const x of testCases) {
      await expect(gov.applyMonitor(0x02, testPkX, testIntro, {value: x}))
          .to.be.revertedWith("deposit-too-less");
    }
  });

  it("applyMonitor: monitor-existed", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    for (const op of [op1, op2, op3]) {
      const args = [0x02, testPkX, testIntro, {value: minStakedAmt}];
      await gov.connect(op).applyMonitor(...args); // ok
      await expect(gov.connect(op).applyMonitor(...args))
          .to.be.revertedWith("monitor-existed");
    }
  });

  it("applyMonitor: ok", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);

    await expect(gov.connect(op1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)}))
        .to.emit(gov, 'MonitorApply').withArgs(op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1));

    await expect(gov.connect(op2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)}))
        .to.emit(gov, 'MonitorApply').withArgs(op2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2));

    await expect(gov.connect(op3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)}))
        .to.emit(gov, 'MonitorApply').withArgs(op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3));

    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [op2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2), 0],
      [op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
    ]);

    expect(await gov.getMonitorIdx(op1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op2.address)).to.be.equal(1);
    expect(await gov.getMonitorIdx(op3.address)).to.be.equal(2);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(6));
  });

  it("addStake: errors", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);

    await expect(gov.connect(op1).addStake())
        .to.be.revertedWith('not-monitor');

    await gov.connect(op1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await expect(gov.connect(op2).addStake())
        .to.be.revertedWith('not-monitor');
    await expect(gov.connect(op3).addStake())
        .to.be.revertedWith('not-monitor');
    await expect(gov.connect(op1).addStake())
        .to.be.revertedWith('deposit-nothing');
  });

  it("addStake: ok", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);
    await gov.connect(op1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(op2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(op3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(6));

    await expect(gov.connect(op1).addStake({value: 100}))
        .to.emit(gov, 'MonitorStake').withArgs(op1.address, 100);
    await expect(gov.connect(op2).addStake({value: 200}))
        .to.emit(gov, 'MonitorStake').withArgs(op2.address, 200);
    await expect(gov.connect(op3).addStake({value: 300}))
        .to.emit(gov, 'MonitorStake').withArgs(op3.address, 300);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(606));

    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(101), 0],
      [op2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(202), 0],
      [op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(303), 0],
    ]);
  });

  it("removeStake: errors", async () => {
    const { gov, op1, op2, op3 } = await loadFixture(deployGov);

    await expect(gov.connect(op1).removeStake(123))
        .to.be.revertedWith('not-monitor');

    await gov.connect(op1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(op2).applyMonitor(0x02, testPkX2, testIntro2, {value: minStakedAmt.add(2)});

    await expect(gov.connect(op3).removeStake(123))
        .to.be.revertedWith('not-monitor');
    await expect(gov.connect(op1).removeStake(minStakedAmt.add(2)))
        .to.be.revertedWith('withdraw-too-much');
    await expect(gov.connect(op2).removeStake(minStakedAmt.add(100)))
        .to.be.revertedWith('withdraw-too-much');

    await gov.setElectedTime(1, 123456789);
    await expect(gov.connect(op2).removeStake(123))
        .to.be.revertedWith('monitor-is-active');
    await expect(gov.connect(op1).removeStake(123))
        .to.be.revertedWith('outside-unstake-window');
  });

  it("removeStake: ok", async () => {
    const { gov, op1, op2, op3, op4, op5, op6 } = await loadFixture(deployGov);

    await gov.connect(op1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(op2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(op3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});
    await gov.connect(op4).applyMonitor(0x03, testPkX4, testIntro4, {value: minStakedAmt.add(4)});
    await gov.connect(op5).applyMonitor(0x02, testPkX5, testIntro5, {value: minStakedAmt.add(5)});
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [op2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2), 0],
      [op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [op4.address, 0x03, testPkX4, testIntro4, minStakedAmt.add(4), 0],
      [op5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
    ]);
    expect(await gov.getMonitorIdx(op1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op2.address)).to.be.equal(1);
    expect(await gov.getMonitorIdx(op3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(op4.address)).to.be.equal(3);
    expect(await gov.getMonitorIdx(op5.address)).to.be.equal(4);
    expect(await gov.getFreeSlots()).to.deep.equal([]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(5).add(15));

    await gov.setLastElectionTime();
    await expect(gov.connect(op4).removeStake(5))
        .to.emit(gov, 'MonitorUnstake').withArgs(op4.address, 5);
    await expect(gov.connect(op2).removeStake(minStakedAmt.add(2))) // remove all
        .to.emit(gov, 'MonitorUnstake').withArgs(op2.address, minStakedAmt.add(2));
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32,              0,  0],
      [op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [op4.address, 0x03, testPkX4, testIntro4, minStakedAmt.sub(1), 0],
      [op5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
    ]);
    expect(await gov.getMonitorIdx(op1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op2.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(op4.address)).to.be.equal(3);
    expect(await gov.getMonitorIdx(op5.address)).to.be.equal(4);
    expect(await gov.getFreeSlots()).to.deep.equal([1]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(4).add(8));

    await expect(gov.connect(op4).removeStake(minStakedAmt.sub(1))) // remove all
        .to.emit(gov, 'MonitorUnstake').withArgs(op4.address, minStakedAmt.sub(1));
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32,              0,  0],
      [op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32,              0,  0],
      [op5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
    ]);
    expect(await gov.getMonitorIdx(op1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op2.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(op4.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op5.address)).to.be.equal(4);
    expect(await gov.getFreeSlots()).to.deep.equal([1, 3]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(9));

    await gov.connect(op2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(op4).applyMonitor(0x03, testPkX4, testIntro4, {value: minStakedAmt.add(4)});
    await gov.connect(op6).applyMonitor(0x02, testPkX6, testIntro6, {value: minStakedAmt.add(6)});
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [op1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [op4.address, 0x03, testPkX4, testIntro4, minStakedAmt.add(4), 0],
      [op3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [op2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2), 0],
      [op5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
      [op6.address, 0x02, testPkX6, testIntro6, minStakedAmt.add(6), 0],
    ]);
    expect(await gov.getMonitorIdx(op1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(op2.address)).to.be.equal(3);
    expect(await gov.getMonitorIdx(op3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(op4.address)).to.be.equal(1);
    expect(await gov.getMonitorIdx(op5.address)).to.be.equal(4);
    expect(await gov.getMonitorIdx(op6.address)).to.be.equal(5);
    expect(await gov.getFreeSlots()).to.deep.equal([]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(6).add(21));
  });

  it("isMonitor", async () => {
    const { gov, op1, op2, op3, op4, op5 } = await loadFixture(deployGov);
    expect(await gov.isMonitor(op1.address)).to.be.equal(false);
    expect(await gov.isMonitor(op3.address)).to.be.equal(false);
    expect(await gov.isMonitor(op5.address)).to.be.equal(false);

    await gov.connect(op1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(op2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(op3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});
    expect(await gov.isMonitor(op1.address)).to.be.equal(false);
    expect(await gov.isMonitor(op3.address)).to.be.equal(false);
    expect(await gov.isMonitor(op5.address)).to.be.equal(false);

    await gov.setElectedTime(0, 123456789);
    await gov.setElectedTime(1, 123456789);
    expect(await gov.isMonitor(op1.address)).to.be.equal(true);
    expect(await gov.isMonitor(op2.address)).to.be.equal(true);
    expect(await gov.isMonitor(op3.address)).to.be.equal(false);
    expect(await gov.isMonitor(op4.address)).to.be.equal(false);
    expect(await gov.isMonitor(op5.address)).to.be.equal(false);
  });

});


async function getBalance(gov) {
  return gov.provider.getBalance(gov.address);
}
async function getAllMonitorInfos(gov) {
  const ops = [];
  for (let i = 0; ; i++) {
    try {
      ops.push(await getMonitorInfo(gov, i));
    } catch (err) {
      // console.log(err);
      break;
    }
  }
  return ops;
}
async function getMonitorInfo(gov, idx) {
  let [addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime] = await gov.monitors(idx);
  electedTime = electedTime.toNumber();
  return [addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime];
}
