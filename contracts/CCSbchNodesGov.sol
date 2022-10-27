//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import { ICCMonitorsGov } from "./CCMonitorsGov.sol";
// import "hardhat/console.sol";

contract CCSbchNodesGov {

    struct NodeInfo {
        uint id; // start from 1
        bytes32 certHash;
        bytes32 certUrl;
        bytes32 rpcUrl;
        bytes32 intro;
    }

    struct Proposal {
        address proposer;
        address[] newProposers; // proposal for new proposer set
        NodeInfo newNode;       // proposal for new enclave node
        uint obsoleteNodeId;    // proposal for obsolete enclave node
        uint votes;             // bitmap
    }

    event ProposeNewProposers(uint indexed id, address indexed proposer, address[] newProposers);
    event ProposeNewNode     (uint indexed id, address indexed proposer, bytes32 certHash, bytes32 certUrl, bytes32 rpcUrl, bytes32 intro);
    event ProposeObsoleteNode(uint indexed id, address indexed proposer, uint nodeId);
    event VoteProposal       (uint indexed id, address indexed voter, bool agreed);
    event ExecProposal       (uint indexed id);
    event RemoveNodeByMonitor(uint indexed nodeId, address indexed monitor);

    address immutable public MONITORS_GOV_ADDR;

    address[] public proposers;
    mapping(address => uint) proposerIdxByAddr;

    uint public lastNodeId;
    NodeInfo[] public nodes;
    mapping(uint => uint) nodeIdxById;

    uint public minProposalId;
    Proposal[] public proposals;

    modifier onlyProposer() {
        require(isProposer(msg.sender), 'not-proposer');
        _;
    }

    modifier onlyMonitor() {
        require(ICCMonitorsGov(MONITORS_GOV_ADDR).isMonitor(msg.sender), 'not-monitor');
        _;
    }

    constructor(address monitorsGovAddr, address[] memory _proposers) {
        MONITORS_GOV_ADDR = monitorsGovAddr;
        require(_proposers.length > 0, 'no-proposers');
        require(_proposers.length <= 256, 'too-many-proposers');
        for (uint i = 0; i < _proposers.length; i++) {
            setNewProposer(_proposers[i], i);
        }
    }

    function getNodeCount() public view returns (uint) {
        return nodes.length;
    }

    function getAllProposers() public view returns (address[] memory _proposers) {
        _proposers = proposers;
    }
    function getProposal(uint id) public view returns (address proposer,
                                                       address[] memory newProposers,
                                                       NodeInfo memory newNode,
                                                       uint obsoleteNodeId,
                                                       uint votes) {
        Proposal storage proposal = proposals[id];
        proposer = proposal.proposer;
        newProposers = proposal.newProposers;
        newNode = proposal.newNode;
        obsoleteNodeId = proposal.obsoleteNodeId;
        votes = proposal.votes;
    }


    function proposeNewProposers(address[] calldata newProposers) public onlyProposer {
        require(newProposers.length > 0, 'no-new-proposers');
        require(newProposers.length <= 256, 'too-many-proposers');
        proposals.push(Proposal(msg.sender, newProposers, NodeInfo(0,'','','',''), 0, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeNewProposers(id, msg.sender, newProposers);
    }

    function proposeNewNode(bytes32 certHash, bytes32 certUrl, bytes32 rpcUrl, bytes32 intro) public onlyProposer {
        NodeInfo memory node = NodeInfo(0, certHash, certUrl, rpcUrl, intro);
        proposals.push(Proposal(msg.sender, new address[](0), node, 0, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeNewNode(id, msg.sender, certHash, certUrl, rpcUrl, intro);
    }

    function proposeObsoleteNode(uint nodeId) public onlyProposer {
        uint nodeIdx = nodeIdxById[nodeId];
        require(nodeIdx < nodes.length && nodes[nodeIdx].id == nodeId, 'no-such-node');

        proposals.push(Proposal(msg.sender, new address[](0), NodeInfo(0,'','','',''), nodeId, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeObsoleteNode(id, msg.sender, nodeId);
    }

    function voteProposal(uint id, bool agreed) public onlyProposer {
        require(id >= minProposalId, 'outdated-proposal');
        require(id < proposals.length, 'no-such-proposal');

        Proposal storage proposal = proposals[id];
        require(proposal.proposer != address(0), 'executed-proposal');

        _vote(id, agreed);
        emit VoteProposal(id, msg.sender, agreed);
    }
    function _vote(uint id, bool agreed) private {        
        uint idx = proposerIdxByAddr[msg.sender];
        uint mask = 1 << (idx & 0xff);
        if (agreed) {
            proposals[id].votes |= mask;
        } else {
            proposals[id].votes &= ~mask;
        }
    }

    function execProposal(uint id) public {
        require(id >= minProposalId, 'outdated-proposal');
        require(id < proposals.length, 'no-such-proposal');

        Proposal storage proposal = proposals[id];
        require(proposal.proposer != address(0), 'executed-proposal');

        uint minVoteCount = proposers.length * 2 / 3;
        uint voteCount = getVoteCount(proposal.votes);
        require(voteCount >= minVoteCount, 'not-enough-votes');

        if (proposal.newProposers.length > 0) {
            clearOldProposers();
            setNewProposers(proposal.newProposers);
            minProposalId = proposals.length;
            delete proposals[id];
        } else if (proposal.newNode.certHash > 0) {
            NodeInfo storage node = proposal.newNode;
            node.id = ++lastNodeId;
            nodes.push(node);
            nodeIdxById[node.id] = nodes.length - 1;
            delete proposals[id];
        } else {
            assert(proposal.obsoleteNodeId > 0);
            removeNodeById(proposal.obsoleteNodeId);
            delete proposals[id];
        }

        emit ExecProposal(id);
    }

    function removeNode(uint id) public onlyMonitor {
        removeNodeById(id);
        emit RemoveNodeByMonitor(id, msg.sender);
    }

    function getVoteCount(uint votes) private pure returns (uint n) {
        while (votes > 0) {
            n += votes & 1;
            votes >>= 1;
        }
    }
    function clearOldProposers() private {
        for (uint i = proposers.length; i > 0; i--) {
            delete proposerIdxByAddr[proposers[i - 1]];
            proposers.pop();
        }
    }
    function setNewProposers(address[] storage newProposers) private {
        for (uint i = 0; i < newProposers.length; i++) {
            setNewProposer(newProposers[i], i);
        }
    }
    function setNewProposer(address proposer, uint idx) private {
        require(!isProposer(proposer), 'duplicated-proposer');
        proposerIdxByAddr[proposer] = idx;
        proposers.push(proposer);
    }
    function isProposer(address addr) private view returns (bool) {
        uint idx = proposerIdxByAddr[addr];
        return proposers.length > 0 && proposers[idx] == addr;
    }

    function removeNodeById(uint nodeId) internal {
        uint nodeIdx = nodeIdxById[nodeId];
        require(nodeIdx < nodes.length && nodes[nodeIdx].id == nodeId,
            'no-such-node');

        if (nodes.length > 1) {
            NodeInfo storage lastNode = nodes[nodes.length - 1];
            nodes[nodeIdx] = lastNode;
            nodeIdxById[lastNode.id] = nodeIdx;
        }
        nodes.pop();
        delete nodeIdxById[nodeId];
    }

}

contract CCSbchNodesGovForUT is CCSbchNodesGov {

    constructor(address monitorsGovAddr, address[] memory _proposers) 
        CCSbchNodesGov(monitorsGovAddr, _proposers) {}

    function getProposerIdx(address addr) public view returns (uint) {
        return proposerIdxByAddr[addr];
    }
    function getNodeIdx(uint id) public view returns (uint) {
        return nodeIdxById[id];
    }

}

contract CCSbchNodesGovForIntegrationTest is CCSbchNodesGov {

    constructor() CCSbchNodesGov(address(0x0), new address[](1)) {}

    function addNode(bytes32 certHash,
                     bytes32 certUrl,
                     bytes32 rpcUrl,
                     bytes32 intro) public {
        uint id = nodes.length + 1;
        nodes.push(NodeInfo(id, certHash, certUrl, rpcUrl, intro));
        nodeIdxById[id] = id - 1;
    }

    function delNode(uint id) public {
        removeNodeById(id);
    }

}

