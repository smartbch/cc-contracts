const { expect } = require("chai");

const zeroAddr = '0x0000000000000000000000000000000000000000';
const zeroBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

const testPbkHash0 = ethers.utils.formatBytes32String('testPbkHash0');
const testPbkHash1 = ethers.utils.formatBytes32String('testPbkHash1');
const testPbkHash2 = ethers.utils.formatBytes32String('testPbkHash2');
const testPbkHash3 = ethers.utils.formatBytes32String('testPbkHash3');
const testPbkHash4 = ethers.utils.formatBytes32String('testPbkHash4');
const testRpcUrl0  = ethers.utils.formatBytes32String('testRpcUrl0');
const testRpcUrl1  = ethers.utils.formatBytes32String('testRpcUrl1');
const testRpcUrl2  = ethers.utils.formatBytes32String('testRpcUrl2');
const testRpcUrl3  = ethers.utils.formatBytes32String('testRpcUrl3');
const testRpcUrl4  = ethers.utils.formatBytes32String('testRpcUrl4');
const testIntro0   = ethers.utils.formatBytes32String('testIntro0');
const testIntro1   = ethers.utils.formatBytes32String('testIntro1');
const testIntro2   = ethers.utils.formatBytes32String('testIntro2');
const testIntro3   = ethers.utils.formatBytes32String('testIntro3');
const testIntro4   = ethers.utils.formatBytes32String('testIntro4');

const testPbkHash  = testPbkHash0;
const testRpcUrl   = testRpcUrl0;
const testIntro    = testIntro0;

const testNewNode  = { id: 0, pubkeyHash: testPbkHash, rpcUrl: testRpcUrl,  intro: testIntro   };
const emptyNewNode = { id: 0, pubkeyHash: zeroBytes32, rpcUrl: zeroBytes32, intro: zeroBytes32 };


describe("CCSbchNodesGov", function () {

  let p1, p2, p3, p4, p5, p6;
  let NodesGov, MonitorsGovMock;
  let monitorsGovMock, monitorsGovAddr;
  let operatorsGovMock, operatorsMockAddr;

  before(async () => {
    [p1, p2, p3, p4, p5, p6] = await ethers.getSigners();
    NodesGov = await ethers.getContractFactory("CCSbchNodesGovForUT");
    MonitorsGovMock = await ethers.getContractFactory("CCMonitorsGovMock");
    OperatorsGovMock = await ethers.getContractFactory("CCOperatorsGovMock");
  });

  beforeEach(async () => {
    monitorsGovMock = await MonitorsGovMock.deploy();
    monitorsGovAddr = monitorsGovMock.address;
    operatorsGovMock = await OperatorsGovMock.deploy();
    operatorsGovAddr = operatorsGovMock.address;
  });

  it("init: errors", async () => {
    await expect(NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, []))
      .to.be.revertedWith('no-proposers');
    await expect(NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, Array(257).fill(p1.address)))
      .to.be.revertedWith('too-many-proposers');
    await expect(NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, [p1.address, p2.address, p1.address]))
      .to.be.revertedWith('duplicated-proposer');
    await expect(NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, [p1.address, p2.address, p2.address]))
      .to.be.revertedWith('duplicated-proposer');
  });

  it("init: ok", async () => {
    const proposers = [p1.address, p2.address, p3.address];
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();
    expect(await gov.getAllProposers()).to.deep.equal(proposers);
    expect(await gov.getProposerIdx(p1.address)).to.be.equal(0);
    expect(await gov.getProposerIdx(p2.address)).to.be.equal(1);
    expect(await gov.getProposerIdx(p3.address)).to.be.equal(2);
  });

  it("propose: errors", async () => {
    const proposers = [p1.address, p2.address, p3.address];
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    await expect(gov.connect(p5).proposeNewProposers([p5.address]))
      .to.be.revertedWith('not-proposer');
    await expect(gov.proposeNewProposers([]))
      .to.be.revertedWith('no-new-proposers');
    await expect(gov.proposeNewProposers(Array(258).fill(p1.address)))
      .to.be.revertedWith('too-many-proposers');

    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];
    await expect(gov.connect(p5).proposeNewNode(...newNodeArgs))
      .to.be.revertedWith('not-proposer');

    await expect(gov.connect(p5).proposeObsoleteNode(123))
      .to.be.revertedWith('not-proposer');
    await expect(gov.connect(p1).proposeObsoleteNode(123))
      .to.be.revertedWith('no-such-node');
  });

  it("propose: ok", async () => {
    const proposers = [p1, p2, p3, p4, p5, p6];
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers.map(x => x.address));
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];

    // make 2 NewProposers proposals
    await expect(gov.connect(p1).proposeNewProposers(newProposers))
        .to.emit(gov, 'ProposeNewProposers').withArgs(0, p1.address, newProposers);
    await expect(gov.connect(p2).proposeNewProposers(newProposers))
        .to.emit(gov, 'ProposeNewProposers').withArgs(1, p2.address, newProposers);

    // make 2 NewNode proposals
    await expect(gov.connect(p3).proposeNewNode(...newNodeArgs))
        .to.emit(gov, 'ProposeNewNode').withArgs(2, p3.address, ...newNodeArgs);
    await expect(gov.connect(p4).proposeNewNode(...newNodeArgs))
        .to.emit(gov, 'ProposeNewNode').withArgs(3, p4.address, ...newNodeArgs);

    // make 1 ObsoleteNode proposal
    await expect(gov.connect(p5).proposeNewNode(...newNodeArgs))
        .to.emit(gov, 'ProposeNewNode').withArgs(4, p5.address, ...newNodeArgs);
    await gov.connect(p1).voteProposal(4, true);
    await gov.connect(p2).voteProposal(4, true);
    await gov.connect(p3).voteProposal(4, true);
    await gov.connect(p4).voteProposal(4, true);
    await gov.connect(p5).execProposal(4);
    await expect(gov.connect(p6).proposeObsoleteNode(1))
        .to.emit(gov, 'ProposeObsoleteNode').withArgs(5, p6.address, 1);

    // check all proposals
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p1.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:      '1' },
      { id: 1, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:     '10' },
      { id: 2, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:    '100' },
      { id: 3, proposer: p4.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:   '1000' },
      { id: 4, proposer: zeroAddr,   newProposers: [],           newNode: emptyNewNode, obsoleteNodeId: 0, votes:      '0' },
      { id: 5, proposer: p6.address, newProposers: [],           newNode: emptyNewNode, obsoleteNodeId: 1, votes: '100000' },
    ]);
  });

  it("vote: errors", async () => {
    const proposers = [p1.address, p2.address, p3.address];
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];

    // make 3 proposals
    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p3).proposeNewNode(...newNodeArgs);    // proposal#1
    await gov.connect(p3).proposeNewNode(...newNodeArgs);    // proposal#2
    await expect(gov.connect(p4).voteProposal(0, true)).to.be.revertedWith('not-proposer');
    await expect(gov.connect(p5).voteProposal(1, false)).to.be.revertedWith('not-proposer');
    await expect(gov.connect(p6).voteProposal(2, false)).to.be.revertedWith('not-proposer');
    await expect(gov.connect(p1).voteProposal(3, false)).to.be.revertedWith('no-such-proposal');

    // exec proposal#1
    await gov.connect(p1).voteProposal(1, true);
    await gov.connect(p5).execProposal(1);
    await expect(gov.connect(p2).voteProposal(1, false)).to.be.revertedWith('executed-proposal');

    // exec proposal#0
    await gov.connect(p1).voteProposal(0, true);
    await gov.connect(p5).execProposal(0);
    await expect(gov.connect(p2).voteProposal(2, false)).to.be.revertedWith('outdated-proposal');
  });

  it("vote: ok", async () => {
    const proposers = [p1, p2, p3, p4, p5].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];

    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p3).proposeNewNode(...newNodeArgs);    // proposal#1

    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:   '10' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '100' },
    ]);

    await expect(gov.connect(p1).voteProposal(1, true))
      .to.emit(gov, 'VoteProposal').withArgs(1, p1.address, true);
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:   '10' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '101' },
    ]);

    await expect(gov.connect(p2).voteProposal(0, false))
      .to.emit(gov, 'VoteProposal').withArgs(0, p2.address, false);
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:    '0' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '101' },
    ]);

    await expect(gov.connect(p5).voteProposal(1, true))
      .to.emit(gov, 'VoteProposal').withArgs(1, p5.address, true);
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:     '0' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes: '10101' },
    ]);

    await expect(gov.connect(p3).voteProposal(1, false))
      .to.emit(gov, 'VoteProposal').withArgs(1, p3.address, false);
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:     '0' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes: '10001' },
    ]);
  });

  it("exec: errors", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    const newProposers = [p2, p3, p4].map(x => x.address);
    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];

    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p2).proposeNewNode(...newNodeArgs);    // proposal#1
    await gov.connect(p2).proposeNewNode(...newNodeArgs);    // proposal#2
  
    await expect(gov.connect(p1).execProposal(3)).to.be.revertedWith('no-such-proposal');
    await expect(gov.connect(p1).execProposal(2)).to.be.revertedWith('not-enough-votes');
    await expect(gov.connect(p1).execProposal(1)).to.be.revertedWith('not-enough-votes');

    await gov.connect(p3).voteProposal(1, true);
    await gov.connect(p4).execProposal(1);
    await expect(gov.connect(p1).execProposal(1)).to.be.revertedWith('executed-proposal');

    await gov.connect(p3).voteProposal(0, true);
    await gov.connect(p4).execProposal(0);
    await expect(gov.connect(p1).execProposal(0)).to.be.revertedWith('outdated-proposal');
    await expect(gov.connect(p1).execProposal(1)).to.be.revertedWith('outdated-proposal');
    await expect(gov.connect(p1).execProposal(2)).to.be.revertedWith('outdated-proposal');
  });

  it("exec: ok", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    const newProposers = [p2, p3, p4].map(x => x.address);
    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];

    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p2).proposeNewNode(...newNodeArgs);    // proposal#1

    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:  '10' },
      { id: 1, proposer: p2.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '10' },
    ]);

    await gov.connect(p3).voteProposal(1, true);
    await expect(gov.connect(p4).execProposal(1)).to.emit(gov, 'ExecProposal').withArgs(1);

    await gov.connect(p3).voteProposal(0, true);
    await expect(gov.connect(p4).execProposal(0)).to.emit(gov, 'ExecProposal').withArgs(0);
    expect(await gov.getAllProposers()).to.deep.equal(newProposers);

    // proposal data is cleared
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: zeroAddr, newProposers: [], newNode: emptyNewNode, obsoleteNodeId: 0, votes: '0' },
      { id: 1, proposer: zeroAddr, newProposers: [], newNode: emptyNewNode, obsoleteNodeId: 0, votes: '0' },
    ]);
  });

  it("exec: newProposers", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();
    expect(await gov.getAllProposers()).to.deep.equal(proposers);
    expect(await gov.getProposerIdx(p1.address)).to.be.equal(0);
    expect(await gov.getProposerIdx(p2.address)).to.be.equal(1);
    expect(await gov.getProposerIdx(p3.address)).to.be.equal(2);

    const newProposers = [p2, p3, p4].map(x => x.address);
    const newNodeArgs = [testPbkHash, testRpcUrl, testIntro];

    // make 5 proposals
    await gov.connect(p1).proposeNewNode(...newNodeArgs);    // proposal#0
    await gov.connect(p2).proposeNewNode(...newNodeArgs);    // proposal#1
    await gov.connect(p3).proposeNewProposers(newProposers); // proposal#2
    await gov.connect(p2).proposeNewNode(...newNodeArgs);    // proposal#3
    await gov.connect(p1).proposeNewNode(...newNodeArgs);    // proposal#4
    // vote & exec proposal#2  
    await gov.connect(p1).voteProposal(2, true);
    await gov.connect(p2).execProposal(2);
    expect(await gov.minProposalId()).to.be.equal(5);
    expect(await gov.getAllProposers()).to.deep.equal(newProposers);
    expect(await gov.getProposerIdx(p2.address)).to.be.equal(0);
    expect(await gov.getProposerIdx(p3.address)).to.be.equal(1);
    expect(await gov.getProposerIdx(p4.address)).to.be.equal(2);
  });

  it("exec: nodes", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    // create 5 NewNode proposals
    await gov.connect(p2).proposeNewNode(testPbkHash0, testRpcUrl0, testIntro0); // proposal#0
    await gov.connect(p2).proposeNewNode(testPbkHash1, testRpcUrl1, testIntro1); // proposal#1
    await gov.connect(p2).proposeNewNode(testPbkHash2, testRpcUrl2, testIntro2); // proposal#2
    await gov.connect(p2).proposeNewNode(testPbkHash3, testRpcUrl3, testIntro3); // proposal#3
    await gov.connect(p2).proposeNewNode(testPbkHash4, testRpcUrl4, testIntro4); // proposal#4

    // execute 4 of them
    await gov.connect(p1).voteProposal(1, true);
    await gov.connect(p1).execProposal(1);
    await gov.connect(p1).voteProposal(3, true);
    await gov.connect(p1).execProposal(3);
    await gov.connect(p1).voteProposal(2, true);
    await gov.connect(p1).execProposal(2);
    await gov.connect(p1).voteProposal(4, true);
    await gov.connect(p1).execProposal(4);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, pubkeyHash: testPbkHash1, rpcUrl: testRpcUrl1, intro: testIntro1 },
      { id: 2, pubkeyHash: testPbkHash3, rpcUrl: testRpcUrl3, intro: testIntro3 },
      { id: 3, pubkeyHash: testPbkHash2, rpcUrl: testRpcUrl2, intro: testIntro2 },
      { id: 4, pubkeyHash: testPbkHash4, rpcUrl: testRpcUrl4, intro: testIntro4 },
    ]);
    expect(await gov.getNodeIdx(1)).to.be.equal(0);
    expect(await gov.getNodeIdx(2)).to.be.equal(1);
    expect(await gov.getNodeIdx(3)).to.be.equal(2);
    expect(await gov.getNodeIdx(4)).to.be.equal(3);

    // obsolete node#2
    await gov.connect(p2).proposeObsoleteNode(2); // proposal#5
    await gov.connect(p1).voteProposal(5, true);
    await expect(gov.connect(p1).execProposal(5)).to.emit(gov, 'ExecProposal').withArgs(5);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, pubkeyHash: testPbkHash1, rpcUrl: testRpcUrl1, intro: testIntro1 },
      { id: 4, pubkeyHash: testPbkHash4, rpcUrl: testRpcUrl4, intro: testIntro4 },
      { id: 3, pubkeyHash: testPbkHash2, rpcUrl: testRpcUrl2, intro: testIntro2 },
    ]);
    expect(await gov.getNodeIdx(1)).to.be.equal(0);
    expect(await gov.getNodeIdx(2)).to.be.equal(0);
    expect(await gov.getNodeIdx(3)).to.be.equal(2);
    expect(await gov.getNodeIdx(4)).to.be.equal(1);

    // obsolete node#4
    await gov.connect(p2).proposeObsoleteNode(4); // proposal#6
    await gov.connect(p1).voteProposal(6, true);
    await expect(gov.connect(p1).execProposal(6)).to.emit(gov, 'ExecProposal').withArgs(6);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, pubkeyHash: testPbkHash1, rpcUrl: testRpcUrl1, intro: testIntro1 },
      { id: 3, pubkeyHash: testPbkHash2, rpcUrl: testRpcUrl2, intro: testIntro2 },
    ]);
    expect(await gov.getNodeIdx(1)).to.be.equal(0);
    expect(await gov.getNodeIdx(2)).to.be.equal(0);
    expect(await gov.getNodeIdx(3)).to.be.equal(1);
    expect(await gov.getNodeIdx(4)).to.be.equal(0);

    // obsolete node#3
    await gov.connect(p2).proposeObsoleteNode(3); // proposal#7
    await gov.connect(p1).voteProposal(7, true);
    await expect(gov.connect(p1).execProposal(7)).to.emit(gov, 'ExecProposal').withArgs(7);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, pubkeyHash: testPbkHash1, rpcUrl: testRpcUrl1, intro: testIntro1 },
    ]);
    expect(await gov.getNodeIdx(1)).to.be.equal(0);
    expect(await gov.getNodeIdx(2)).to.be.equal(0);
    expect(await gov.getNodeIdx(3)).to.be.equal(0);
    expect(await gov.getNodeIdx(4)).to.be.equal(0);

    // obsolete node#1
    await gov.connect(p2).proposeObsoleteNode(1); // proposal#8
    await gov.connect(p1).voteProposal(8, true);
    await expect(gov.connect(p1).execProposal(8)).to.emit(gov, 'ExecProposal').withArgs(8);
    expect(await getAllNodes(gov)).to.deep.equal([
    ]);
  });

  it("removeNodeByMonitor: ok", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    // create 3 NewNode proposals
    await gov.connect(p2).proposeNewNode(testPbkHash0, testRpcUrl0, testIntro0); // proposal#0
    await gov.connect(p2).proposeNewNode(testPbkHash1, testRpcUrl1, testIntro1); // proposal#1
    await gov.connect(p2).proposeNewNode(testPbkHash2, testRpcUrl2, testIntro2); // proposal#2
    await gov.connect(p1).voteProposal(0, true);
    await gov.connect(p1).execProposal(0);
    await gov.connect(p1).voteProposal(1, true);
    await gov.connect(p1).execProposal(1);
    await gov.connect(p1).voteProposal(2, true);
    await gov.connect(p1).execProposal(2);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, pubkeyHash: testPbkHash0, rpcUrl: testRpcUrl0, intro: testIntro0 },
      { id: 2, pubkeyHash: testPbkHash1, rpcUrl: testRpcUrl1, intro: testIntro1 },
      { id: 3, pubkeyHash: testPbkHash2, rpcUrl: testRpcUrl2, intro: testIntro2 },
    ]);

    await expect(gov.connect(p3).removeNode(1)).to.be.revertedWith('not-monitor');

    await monitorsGovMock.connect(p5).becomeMonitor();
    await expect(gov.connect(p5).removeNode(9)).to.be.revertedWith('no-such-node');

    await expect(gov.connect(p5).removeNode(2)).to.emit(gov, 'RemoveNodeByMonitor').withArgs(2, p5.address);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, pubkeyHash: testPbkHash0, rpcUrl: testRpcUrl0, intro: testIntro0 },
      { id: 3, pubkeyHash: testPbkHash2, rpcUrl: testRpcUrl2, intro: testIntro2 },
    ]);
  });

  it("syncProposers", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(monitorsGovAddr, operatorsGovAddr, proposers);
    await gov.deployed();

    // create 3 proposals
    await gov.connect(p1).proposeNewNode(testPbkHash0, testRpcUrl0, testIntro0); // proposal#0
    await gov.connect(p2).proposeNewNode(testPbkHash1, testRpcUrl1, testIntro1); // proposal#1
    await gov.connect(p3).proposeNewNode(testPbkHash2, testRpcUrl2, testIntro2); // proposal#2
    expect(await gov.getAllProposers()).to.deep.equal(proposers);
    expect(await gov.minProposalId()).to.equal(0);

    // sync
    await operatorsGovMock.connect(p2).becomeOperator();
    await operatorsGovMock.connect(p4).becomeOperator();
    await operatorsGovMock.connect(p5).becomeOperator();
    await gov.syncProposers();
    expect(await gov.getAllProposers()).to.deep.equal([p2, p4, p5].map(x => x.address));
    expect(await gov.minProposalId()).to.equal(3);

    // create 3 more proposals
    await gov.connect(p2).proposeNewNode(testPbkHash0, testRpcUrl0, testIntro0); // proposal#3
    await gov.connect(p4).proposeNewNode(testPbkHash1, testRpcUrl1, testIntro1); // proposal#4
    await gov.connect(p5).proposeNewNode(testPbkHash2, testRpcUrl2, testIntro2); // proposal#5

    // sync no-op
    await gov.syncProposers();
    expect(await gov.getAllProposers()).to.deep.equal([p2, p4, p5].map(x => x.address));
    expect(await gov.minProposalId()).to.equal(3);
  });

});


async function getAllProposals(gov) {
  const proposals = [];
  for (let i = 0; ; i++) {
    try {
      proposals.push(await getProposal(gov, i));
    } catch (err) {
      // console.log(err);
      break;
    }
  }
  return proposals;
}
async function getProposal(gov, id) {
  // let proposal = await gov.proposals(id);
  let [proposer, newProposers, newNode, obsoleteNodeId, votes] = await gov.getProposal(id);
  // console.log(proposal);
  newNode = {
    id: newNode.id.toNumber(),
    pubkeyHash: newNode.pubkeyHash,
    rpcUrl: newNode.rpcUrl,
    intro: newNode.intro,
  }
  obsoleteNodeId = obsoleteNodeId.toNumber();
  votes = BigInt(votes.toString()).toString(2)
  return {id, proposer, newProposers, newNode, obsoleteNodeId, votes};
}

async function getAllNodes(gov) {
  const nodes = [];
  const n = await gov.getNodeCount();
  for (let i = 0; i < n; i++) {
    try {
      nodes.push(await getNode(gov, i));
    } catch (err) {
      // console.log(err);
      break;
    }
  }
  return nodes;
}
async function getNode(gov, idx) {
  let [id, pubkeyHash, rpcUrl, intro] = await gov.nodes(idx);
  id = id.toNumber();
  return {id, pubkeyHash, rpcUrl, intro};
}
