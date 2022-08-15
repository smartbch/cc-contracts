const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const zeroAddr = '0x0000000000000000000000000000000000000000';
const testNodeInfo = '0x1234';
const testNodeRpcUrl = '0x5678';
const testNodeIntro = '0xabcd';
const testNewNode = { id: 0, information: testNodeInfo, rpcUrl: testNodeRpcUrl, introduction: testNodeIntro};
const emptyNewNode = {id: 0, information: '0x', rpcUrl: '0x', introduction: '0x'};


describe("CCEnclaveNodesGov", function () {

  let p1, p2, p3, p4, p5, p6;
  let NodesGov;

  before(async () => {
    [p1, p2, p3, p4, p5, p6] = await ethers.getSigners();
    NodesGov = await ethers.getContractFactory("CCEnclaveNodesGov");
  });

  it("init: errors", async () => {
    await expect(NodesGov.deploy([]))
      .to.be.revertedWith('no-proposers');
    await expect(NodesGov.deploy(Array(257).fill(p1.address)))
      .to.be.revertedWith('too-many-proposers');
    await expect(NodesGov.deploy([p1.address, p2.address, p1.address]))
      .to.be.revertedWith('duplicated-proposer');
  });

  it("init: ok", async () => {
    const proposers = [p1.address, p2.address, p3.address];
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();
    expect(await gov.getAllProposers()).to.deep.equal(proposers);
  });

  it("propose: errors", async () => {
    const proposers = [p1.address, p2.address, p3.address];
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    await expect(gov.connect(p5).proposeNewProposers([p5.address]))
      .to.be.revertedWith('not-proposer');
    await expect(gov.proposeNewProposers([]))
      .to.be.revertedWith('no-new-proposers');
    await expect(gov.proposeNewProposers(Array(258).fill(p1.address)))
      .to.be.revertedWith('too-many-proposers');

    await expect(gov.connect(p5).proposeNewNode(testNodeInfo, testNodeRpcUrl, testNodeIntro))
      .to.be.revertedWith('not-proposer');
    await expect(gov.connect(p1).proposeNewNode('0x', testNodeRpcUrl, testNodeIntro))
      .to.be.revertedWith('invalid-info');
    await expect(gov.connect(p2).proposeNewNode(testNodeInfo, '0x', testNodeIntro))
      .to.be.revertedWith('invalid-rpc-url');

    await expect(gov.connect(p5).proposeObsoleteNode(123))
      .to.be.revertedWith('not-proposer');
  });

  it("propose: ok", async () => {
    const proposers = [p1, p2, p3, p4, p5, p6];
    const gov = await NodesGov.deploy(proposers.map(x => x.address));
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    await expect(gov.connect(p1).proposeNewProposers(newProposers))
        .to.emit(gov, 'ProposeNewProposers')
        .withArgs(0, p1.address, newProposers);
    await expect(gov.connect(p2).proposeNewProposers(newProposers))
        .to.emit(gov, 'ProposeNewProposers')
        .withArgs(1, p2.address, newProposers);

    await expect(gov.connect(p3).proposeNewNode(testNodeInfo, testNodeRpcUrl, testNodeIntro))
        .to.emit(gov, 'ProposeNewNode')
        .withArgs(2, p3.address, testNodeInfo, testNodeRpcUrl, testNodeIntro);
    await expect(gov.connect(p4).proposeNewNode(testNodeInfo, testNodeRpcUrl, testNodeIntro))
        .to.emit(gov, 'ProposeNewNode')
        .withArgs(3, p4.address, testNodeInfo, testNodeRpcUrl, testNodeIntro);

    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p1.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:    '1' },
      { id: 1, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:   '10' },
      { id: 2, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '100' },
      { id: 3, proposer: p4.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes: '1000' },
    ]);
  });

  it("vote: errors", async () => {
    const proposers = [p1.address, p2.address, p3.address];
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    const nodeInfo = [testNodeInfo, testNodeRpcUrl, testNodeIntro];
    await gov.connect(p3).proposeNewNode(... nodeInfo); // proposal#1

    await expect(gov.connect(p4).voteProposal(0, true))
      .to.be.revertedWith('not-proposer');
    await expect(gov.connect(p5).voteProposal(1, false))
      .to.be.revertedWith('not-proposer');
    await expect(gov.connect(p1).voteProposal(2, false))
      .to.be.revertedWith('no-such-proposal');
  });

  it("vote: ok", async () => {
    const proposers = [p1, p2, p3, p4, p5].map(x => x.address);
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    const nodeInfo = [testNodeInfo, testNodeRpcUrl, testNodeIntro];
    await gov.connect(p3).proposeNewNode(... nodeInfo); // proposal#1

    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:   '10' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '100' },
    ]);

    await expect(gov.connect(p1).voteProposal(1, true))
      .to.emit(gov, 'VoteProposal')
      .withArgs(1, p1.address, true);
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:   '10' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '101' },
    ]);

    await expect(gov.connect(p2).voteProposal(0, false))
      .to.emit(gov, 'VoteProposal')
      .withArgs(0, p2.address, false);
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:    '0' },
      { id: 1, proposer: p3.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '101' },
    ]);
  });

  it("exec: errors", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p2, p3, p4].map(x => x.address);
    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    const nodeInfo = [testNodeInfo, testNodeRpcUrl, testNodeIntro];
    await gov.connect(p2).proposeNewNode(... nodeInfo); // proposal#1
  
    await expect(gov.connect(p1).execProposal(2))
      .to.be.revertedWith('no-such-proposal');
    await expect(gov.connect(p1).execProposal(1))
      .to.be.revertedWith('not-enough-votes');

    await gov.connect(p3).voteProposal(1, true);
    await gov.connect(p4).execProposal(1);
    await expect(gov.connect(p1).execProposal(1))
      .to.be.revertedWith('executed-proposal');

    await gov.connect(p3).voteProposal(0, true);
    await gov.connect(p4).execProposal(0);
    await expect(gov.connect(p1).execProposal(0))
      .to.be.revertedWith('outdated-proposal');
    await expect(gov.connect(p1).execProposal(1))
      .to.be.revertedWith('outdated-proposal');
  });

  it("exec: ok", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p2, p3, p4].map(x => x.address);
    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    const nodeInfo = [testNodeInfo, testNodeRpcUrl, testNodeIntro];
    await gov.connect(p2).proposeNewNode(...nodeInfo); // proposal#1
   
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: p2.address, newProposers: newProposers, newNode: emptyNewNode, obsoleteNodeId: 0, votes:  '10' },
      { id: 1, proposer: p2.address, newProposers: [],           newNode: testNewNode,  obsoleteNodeId: 0, votes:  '10' },
    ]);

    await gov.connect(p3).voteProposal(1, true);
    await expect(gov.connect(p4).execProposal(1))
      .to.emit(gov, 'ExecProposal').withArgs(1);
    // expect(await gov.pubKey()).to.equal(testPubKey2);

    await gov.connect(p3).voteProposal(0, true);
    await expect(gov.connect(p4).execProposal(0))
      .to.emit(gov, 'ExecProposal').withArgs(0);
    expect(await gov.getAllProposers()).to.deep.equal(newProposers);

    // proposal data is cleared
    expect(await getAllProposals(gov)).to.deep.equal([
      { id: 0, proposer: zeroAddr, newProposers: [], newNode: emptyNewNode, obsoleteNodeId: 0, votes: '0' },
      { id: 1, proposer: zeroAddr, newProposers: [], newNode: emptyNewNode, obsoleteNodeId: 0, votes: '0' },
    ]);
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
    information: newNode.information,
    rpcUrl: newNode.rpcUrl,
    introduction: newNode.introduction,
  }
  obsoleteNodeId = obsoleteNodeId.toNumber();
  votes = BigInt(votes.toString()).toString(2)
  return {id, proposer, newProposers, newNode, obsoleteNodeId, votes};
}
