const { expect } = require("chai");

const zeroAddr = '0x0000000000000000000000000000000000000000';
const zeroBytes32    = '0x0000000000000000000000000000000000000000000000000000000000000000';
const testCertHash   = ethers.utils.formatBytes32String('testCertHash');
const testCertUrl    = ethers.utils.formatBytes32String('testCertUrl');
const testNodeRpcUrl = ethers.utils.formatBytes32String('testRpcUrl');
const testNodeIntro  = ethers.utils.formatBytes32String('testNodeIntro');
const testNewNode =  { id: 0, certHash: testCertHash, certUrl: testCertUrl, rpcUrl: testNodeRpcUrl, intro: testNodeIntro };
const emptyNewNode = { id: 0, certHash: zeroBytes32,  certUrl: zeroBytes32, rpcUrl: zeroBytes32,    intro: zeroBytes32   };


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

    const newNodeArgs = [testCertHash, testCertUrl, testNodeRpcUrl, testNodeIntro];
    await expect(gov.connect(p5).proposeNewNode(...newNodeArgs))
      .to.be.revertedWith('not-proposer');

    await expect(gov.connect(p5).proposeObsoleteNode(123))
      .to.be.revertedWith('not-proposer');
    await expect(gov.connect(p1).proposeObsoleteNode(123))
      .to.be.revertedWith('no-such-node');
  });

  it("propose: ok", async () => {
    const proposers = [p1, p2, p3, p4, p5, p6];
    const gov = await NodesGov.deploy(proposers.map(x => x.address));
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    const newNodeArgs = [testCertHash, testCertUrl, testNodeRpcUrl, testNodeIntro];

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
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    const newNodeArgs = [testCertHash, testCertUrl, testNodeRpcUrl, testNodeIntro];

    // make 3 proposals
    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p3).proposeNewNode(...newNodeArgs); // proposal#1
    await gov.connect(p3).proposeNewNode(...newNodeArgs); // proposal#2
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
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p4.address, p3.address, p2.address];
    const newNodeArgs = [testCertHash, testCertUrl, testNodeRpcUrl, testNodeIntro];

    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p3).proposeNewNode(...newNodeArgs); // proposal#1

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
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p2, p3, p4].map(x => x.address);
    const newNodeArgs = [testCertHash, testCertUrl, testNodeRpcUrl, testNodeIntro];

    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p2).proposeNewNode(...newNodeArgs); // proposal#1
    await gov.connect(p2).proposeNewNode(...newNodeArgs); // proposal#2
  
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
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    const newProposers = [p2, p3, p4].map(x => x.address);
    const newNodeArgs = [testCertHash, testCertUrl, testNodeRpcUrl, testNodeIntro];

    await gov.connect(p2).proposeNewProposers(newProposers); // proposal#0
    await gov.connect(p2).proposeNewNode(...newNodeArgs); // proposal#1

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

  it("exec: nodes", async () => {
    const proposers = [p1, p2, p3].map(x => x.address);
    const gov = await NodesGov.deploy(proposers);
    await gov.deployed();

    // create 5 NewNode proposals
    await gov.connect(p2).proposeNewNode(bytes32('cert0'), bytes32('url0'), bytes32('rpc0'), bytes32('node0')); // proposal#0
    await gov.connect(p2).proposeNewNode(bytes32('cert1'), bytes32('url1'), bytes32('rpc1'), bytes32('node1')); // proposal#1
    await gov.connect(p2).proposeNewNode(bytes32('cert2'), bytes32('url2'), bytes32('rpc2'), bytes32('node2')); // proposal#2
    await gov.connect(p2).proposeNewNode(bytes32('cert3'), bytes32('url3'), bytes32('rpc3'), bytes32('node3')); // proposal#3
    await gov.connect(p2).proposeNewNode(bytes32('cert4'), bytes32('url4'), bytes32('rpc4'), bytes32('node4')); // proposal#4

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
      { id: 1, certHash: bytes32('cert1'), certUrl: bytes32('url1'), rpcUrl: bytes32('rpc1'), intro: bytes32('node1') },
      { id: 2, certHash: bytes32('cert3'), certUrl: bytes32('url3'), rpcUrl: bytes32('rpc3'), intro: bytes32('node3') },
      { id: 3, certHash: bytes32('cert2'), certUrl: bytes32('url2'), rpcUrl: bytes32('rpc2'), intro: bytes32('node2') },
      { id: 4, certHash: bytes32('cert4'), certUrl: bytes32('url4'), rpcUrl: bytes32('rpc4'), intro: bytes32('node4') },
    ]);

    // obsolete node#2
    await gov.connect(p2).proposeObsoleteNode(2); // proposal#5
    await gov.connect(p1).voteProposal(5, true);
    await expect(gov.connect(p1).execProposal(5)).to.emit(gov, 'ExecProposal').withArgs(5);
    expect(await getAllNodes(gov)).to.deep.equal([
      { id: 1, certHash: bytes32('cert1'), certUrl: bytes32('url1'), rpcUrl: bytes32('rpc1'), intro: bytes32('node1') },
      { id: 4, certHash: bytes32('cert4'), certUrl: bytes32('url4'), rpcUrl: bytes32('rpc4'), intro: bytes32('node4') },
      { id: 3, certHash: bytes32('cert2'), certUrl: bytes32('url2'), rpcUrl: bytes32('rpc2'), intro: bytes32('node2') },
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
    certHash: newNode.certHash,
    certUrl: newNode.certUrl,
    rpcUrl: newNode.rpcUrl,
    intro: newNode.introduction,
  }
  obsoleteNodeId = obsoleteNodeId.toNumber();
  votes = BigInt(votes.toString()).toString(2)
  return {id, proposer, newProposers, newNode, obsoleteNodeId, votes};
}

async function getAllNodes(gov) {
  const nodes = [];
  for (let i = 0; ; i++) {
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
  let [id, certHash, certUrl, rpcUrl, introduction] = await gov.nodes(idx);
  id = id.toNumber();
  return {id, certHash, certUrl, rpcUrl, intro: introduction};
}


function bytes32(str) {
  return ethers.utils.formatBytes32String(str);
}