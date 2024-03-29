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


const minStakedAmt = ethers.utils.parseUnits('0.1');

describe("CCMonitorsGov", function () {

  async function deployGov() {
    const [mo1, mo2, mo3, mo4, mo5, mo6] = await ethers.getSigners();

    const MockOpsGov = await ethers.getContractFactory("CCOperatorsGovMock");
    const opsGov = await MockOpsGov.deploy();

    const MoitorsGov = await ethers.getContractFactory("CCMonitorsGovForUT");
    const gov = await MoitorsGov.deploy(opsGov.address);

    return { gov, mo1, mo2, mo3, mo4, mo5, mo6, opsGov };
  }

  it("init", async () => {
    const { gov, mo1, mo2, mo3 } = await loadFixture(deployGov);

    // default monitor fields
    let [addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, oldElectedTime, nominatedBy]
        = [mo1.address, 0x02, testPkX, testIntro, minStakedAmt, 0, 0, []];

    await expect(gov.connect(mo3).init([]))
      .to.be.revertedWith('Ownable: caller is not the owner');
    await expect(gov.init([{addr, pubkeyPrefix: 0x04, pubkeyX, intro, stakedAmt, electedTime, oldElectedTime, nominatedBy}]))
      .to.be.revertedWith('invalid-pubkey-prefix');
    await expect(gov.init([{addr, pubkeyPrefix, pubkeyX, intro, stakedAmt: 1234, electedTime, oldElectedTime, nominatedBy}]))
      .to.be.revertedWith('deposit-too-less');

    await expect(gov.init([
      {addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, oldElectedTime, nominatedBy},
      {addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, oldElectedTime, nominatedBy},
    ])).to.be.revertedWith('monitor-existed');

    // ok
    gov.init([{addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, oldElectedTime, nominatedBy}]);

    await expect(gov.init([{addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, oldElectedTime, nominatedBy}]))
      .to.be.revertedWith('already-initialized');
  
    const monitors = await getAllMonitorInfos(gov);
    expect(monitors.map(x => {x.pop(); return x;})).to.deep.equal([
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt],
    ]);
    expect(monitors[0].pop()).to.be.gt(0); // electedTime
  });

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
    const { gov, mo1, mo2, mo3 } = await loadFixture(deployGov);
    for (const op of [mo1, mo2, mo3]) {
      const args = [0x02, testPkX, testIntro, {value: minStakedAmt}];
      await gov.connect(op).applyMonitor(...args); // ok
      await expect(gov.connect(op).applyMonitor(...args))
          .to.be.revertedWith("monitor-existed");
    }
  });

  it("applyMonitor: ok", async () => {
    const { gov, mo1, mo2, mo3 } = await loadFixture(deployGov);

    await expect(gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)}))
        .to.emit(gov, 'MonitorApply').withArgs(mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1));

    await expect(gov.connect(mo2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)}))
        .to.emit(gov, 'MonitorApply').withArgs(mo2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2));

    await expect(gov.connect(mo3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)}))
        .to.emit(gov, 'MonitorApply').withArgs(mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3));

    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [mo2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2), 0],
      [mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
    ]);

    expect(await gov.getMonitorIdx(mo1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo2.address)).to.be.equal(1);
    expect(await gov.getMonitorIdx(mo3.address)).to.be.equal(2);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(6));
  });

  it("addStake: errors", async () => {
    const { gov, mo1, mo2, mo3 } = await loadFixture(deployGov);

    await expect(gov.connect(mo1).addStake(mo1.address))
        .to.be.revertedWith('not-monitor');

    await gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await expect(gov.connect(mo2).addStake(mo2.address))
        .to.be.revertedWith('not-monitor');
    await expect(gov.connect(mo3).addStake(mo3.address))
        .to.be.revertedWith('not-monitor');
    await expect(gov.connect(mo1).addStake(mo1.address))
        .to.be.revertedWith('deposit-nothing');
  });

  it("addStake: ok", async () => {
    const { gov, mo1, mo2, mo3, mo4 } = await loadFixture(deployGov);
    await gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(mo2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(mo3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(6));

    await expect(gov.connect(mo1).addStake(mo1.address, {value: 100}))
        .to.emit(gov, 'MonitorStake').withArgs(mo1.address, 100);
    await expect(gov.connect(mo2).addStake(mo2.address, {value: 200}))
        .to.emit(gov, 'MonitorStake').withArgs(mo2.address, 200);
    await expect(gov.connect(mo3).addStake(mo3.address, {value: 300}))
        .to.emit(gov, 'MonitorStake').withArgs(mo3.address, 300);
    await expect(gov.connect(mo4).addStake(mo3.address, {value: 400}))
        .to.emit(gov, 'MonitorStake').withArgs(mo3.address, 400);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(1006));
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(101), 0],
      [mo2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(202), 0],
      [mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(703), 0],
    ]);
  });

  it("removeStake: errors", async () => {
    const { gov, mo1, mo2, mo3 } = await loadFixture(deployGov);

    await expect(gov.connect(mo1).removeStake(123))
        .to.be.revertedWith('not-monitor');

    await gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(mo2).applyMonitor(0x02, testPkX2, testIntro2, {value: minStakedAmt.add(2)});

    await expect(gov.connect(mo3).removeStake(123))
        .to.be.revertedWith('not-monitor');
    await expect(gov.connect(mo1).removeStake(minStakedAmt.add(2)))
        .to.be.revertedWith('withdraw-too-much');
    await expect(gov.connect(mo2).removeStake(minStakedAmt.add(100)))
        .to.be.revertedWith('withdraw-too-much');

    await gov.setElectedTime(1, 123456789);
    await expect(gov.connect(mo2).removeStake(123))
        .to.be.revertedWith('monitor-is-active');
    // await expect(gov.connect(mo1).removeStake(123))
    //     .to.be.revertedWith('outside-unstake-window');
  });

  it("removeStake: ok", async () => {
    const { gov, mo1, mo2, mo3, mo4, mo5, mo6 } = await loadFixture(deployGov);

    await gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(mo2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(mo3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});
    await gov.connect(mo4).applyMonitor(0x03, testPkX4, testIntro4, {value: minStakedAmt.add(4)});
    await gov.connect(mo5).applyMonitor(0x02, testPkX5, testIntro5, {value: minStakedAmt.add(5)});
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [mo2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2), 0],
      [mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [mo4.address, 0x03, testPkX4, testIntro4, minStakedAmt.add(4), 0],
      [mo5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
    ]);
    expect(await gov.getMonitorIdx(mo1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo2.address)).to.be.equal(1);
    expect(await gov.getMonitorIdx(mo3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(mo4.address)).to.be.equal(3);
    expect(await gov.getMonitorIdx(mo5.address)).to.be.equal(4);
    expect(await gov.getFreeSlots()).to.deep.equal([]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(5).add(15));

    await gov.setLastElectionTime();
    await expect(gov.connect(mo4).removeStake(5))
        .to.emit(gov, 'MonitorUnstake').withArgs(mo4.address, 5);
    await expect(gov.connect(mo2).removeStake(minStakedAmt.add(2))) // remove all
        .to.emit(gov, 'MonitorUnstake').withArgs(mo2.address, minStakedAmt.add(2));
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32,              0,  0],
      [mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [mo4.address, 0x03, testPkX4, testIntro4, minStakedAmt.sub(1), 0],
      [mo5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
    ]);
    expect(await gov.getMonitorIdx(mo1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo2.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(mo4.address)).to.be.equal(3);
    expect(await gov.getMonitorIdx(mo5.address)).to.be.equal(4);
    expect(await gov.getFreeSlots()).to.deep.equal([1]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(4).add(8));

    await expect(gov.connect(mo4).removeStake(minStakedAmt.sub(1))) // remove all
        .to.emit(gov, 'MonitorUnstake').withArgs(mo4.address, minStakedAmt.sub(1));
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32,              0,  0],
      [mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [zeroAddr,    0x00, zeroBytes32, zeroBytes32,              0,  0],
      [mo5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
    ]);
    expect(await gov.getMonitorIdx(mo1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo2.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(mo4.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo5.address)).to.be.equal(4);
    expect(await gov.getFreeSlots()).to.deep.equal([1, 3]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(3).add(9));

    await gov.connect(mo2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(mo4).applyMonitor(0x03, testPkX4, testIntro4, {value: minStakedAmt.add(4)});
    await gov.connect(mo6).applyMonitor(0x02, testPkX6, testIntro6, {value: minStakedAmt.add(6)});
    expect(await getAllMonitorInfos(gov)).to.deep.equal([
      // addr, pubkeyPrefix, pubkeyX,  intro,      stakedAmt, electedTime
      [mo1.address, 0x02, testPkX1, testIntro1, minStakedAmt.add(1), 0],
      [mo4.address, 0x03, testPkX4, testIntro4, minStakedAmt.add(4), 0],
      [mo3.address, 0x02, testPkX3, testIntro3, minStakedAmt.add(3), 0],
      [mo2.address, 0x03, testPkX2, testIntro2, minStakedAmt.add(2), 0],
      [mo5.address, 0x02, testPkX5, testIntro5, minStakedAmt.add(5), 0],
      [mo6.address, 0x02, testPkX6, testIntro6, minStakedAmt.add(6), 0],
    ]);
    expect(await gov.getMonitorIdx(mo1.address)).to.be.equal(0);
    expect(await gov.getMonitorIdx(mo2.address)).to.be.equal(3);
    expect(await gov.getMonitorIdx(mo3.address)).to.be.equal(2);
    expect(await gov.getMonitorIdx(mo4.address)).to.be.equal(1);
    expect(await gov.getMonitorIdx(mo5.address)).to.be.equal(4);
    expect(await gov.getMonitorIdx(mo6.address)).to.be.equal(5);
    expect(await gov.getFreeSlots()).to.deep.equal([]);
    expect(await getBalance(gov)).to.be.equal(minStakedAmt.mul(6).add(21));
  });

  it("isMonitor", async () => {
    const { gov, mo1, mo2, mo3, mo4, mo5 } = await loadFixture(deployGov);
    expect(await gov.isMonitor(mo1.address)).to.be.equal(false);
    expect(await gov.isMonitor(mo3.address)).to.be.equal(false);
    expect(await gov.isMonitor(mo5.address)).to.be.equal(false);

    await gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(mo2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(mo3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});
    expect(await gov.isMonitor(mo1.address)).to.be.equal(false);
    expect(await gov.isMonitor(mo3.address)).to.be.equal(false);
    expect(await gov.isMonitor(mo5.address)).to.be.equal(false);

    await gov.setElectedTime(0, 123456789);
    await gov.setElectedTime(1, 123456789);
    expect(await gov.isMonitor(mo1.address)).to.be.equal(true);
    expect(await gov.isMonitor(mo2.address)).to.be.equal(true);
    expect(await gov.isMonitor(mo3.address)).to.be.equal(false);
    expect(await gov.isMonitor(mo4.address)).to.be.equal(false);
    expect(await gov.isMonitor(mo5.address)).to.be.equal(false);
  });

  it("nominateMonitor", async () => {
    const { gov, mo1, mo2, mo3, mo4, mo5, mo6, opsGov } = await loadFixture(deployGov);
    let [op1, op2] = [mo5, mo6];
    await opsGov.connect(op1).becomeOperator();
    await opsGov.connect(op2).becomeOperator();

    await gov.connect(mo1).applyMonitor(0x02, testPkX1, testIntro1, {value: minStakedAmt.add(1)});
    await gov.connect(mo2).applyMonitor(0x03, testPkX2, testIntro2, {value: minStakedAmt.add(2)});
    await gov.connect(mo3).applyMonitor(0x02, testPkX3, testIntro3, {value: minStakedAmt.add(3)});

    await expect(gov.connect(mo3).nominateMonitor(mo4.address))
        .to.be.revertedWith('not-operator');
    await expect(gov.connect(op1).nominateMonitor(mo4.address))
        .to.be.revertedWith('not-monitor');

    await expect(gov.connect(op2).nominateMonitor(mo2.address))
        .to.emit(gov, 'NominatedBy').withArgs(mo2.address, op2.address);
    await expect(gov.connect(op1).nominateMonitor(mo2.address))
        .to.emit(gov, 'NominatedBy').withArgs(mo2.address, op1.address);
    await expect(gov.connect(op2).nominateMonitor(mo2.address))
        .to.be.revertedWith('already-nominated');

    expect(await gov.getNominatedBy(mo1.address)).to.be.deep.equal([]);
    expect(await gov.getNominatedBy(mo3.address)).to.be.deep.equal([]);
    expect(await gov.getNominatedBy(mo2.address)).to.be.deep.equal([op2.address, op1.address]);
  });

});


async function getBalance(gov) {
  return gov.provider.getBalance(gov.address);
}
async function getAllMonitorInfos(gov) {
  const infos = [];
  for (let i = 0; ; i++) {
    try {
      infos.push(await getMonitorInfo(gov, i));
    } catch (err) {
      // console.log(err);
      break;
    }
  }
  return infos;
}
async function getMonitorInfo(gov, idx) {
  let [addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime] = await gov.monitors(idx);
  electedTime = electedTime.toNumber();
  return [addr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime];
}
