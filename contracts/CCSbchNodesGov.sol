//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import { ICCMonitorsGov } from "./CCMonitorsGov.sol";
import { ICCOperatorsGov } from "./CCOperatorsGov.sol";
// import "hardhat/console.sol";

contract CCSbchNodesGov is Ownable {

    struct NodeInfo {
        uint id; // a unique id for a node starting from 1. It never changes.
        bytes32 pubkeyHash; // sha256 hash of node's RPC pubkey
        bytes32 rpcUrl;
        bytes32 intro;
    }

    struct Proposal {
        address proposer;
        address[] newProposers; // proposal for new proposer set
        NodeInfo newNode;       // proposal for new enclave node
        uint obsoleteNodeId;    // proposal for obsolete enclave node
        uint votes;             // bitmap indicating which proposers support this proposal
    }

    event ProposeNewProposers(uint indexed id, address indexed proposer, address[] newProposers);
    event ProposeNewNode     (uint indexed id, address indexed proposer, bytes32 pubkeyHash, bytes32 rpcUrl, bytes32 intro);
    event ProposeObsoleteNode(uint indexed id, address indexed proposer, uint nodeId);
    event VoteProposal       (uint indexed id, address indexed voter, bool agreed);
    event ExecProposal       (uint indexed id);
    event RemoveNodeByMonitor(uint indexed nodeId, address indexed monitor);

    address immutable public MONITORS_GOV_ADDR;
    address immutable public OPERATORS_GOV_ADDR;
    bytes32 public syncProposersHash; // updated when syncing proposers from the operator set, to prevent resyncing

    address[] public proposers; // all the active proposers
    mapping(address => uint) proposerIdxByAddr;

    uint public lastNodeId; //always increasing
    NodeInfo[] public nodes; // all the active nodes
    mapping(uint => uint) nodeIdxById;

    uint public minProposalId; // a proposal whose id is no less than this value is valid
    Proposal[] public proposals; // all the active/inactive/executed proposals

    modifier onlyProposer() {
        require(isProposer(msg.sender), 'not-proposer');
        _;
    }

    modifier onlyMonitor() {
        require(ICCMonitorsGov(MONITORS_GOV_ADDR).isMonitor(msg.sender), 'not-monitor');
        _;
    }

    constructor(address monitorsGovAddr, address operatorsGovAddr, address[] memory _proposers) {
        MONITORS_GOV_ADDR = monitorsGovAddr;
        OPERATORS_GOV_ADDR = operatorsGovAddr;
        require(_proposers.length > 0, 'no-proposers');
        require(_proposers.length <= 256, 'too-many-proposers');
        setNewProposers(_proposers);
    }

    function init(NodeInfo[] memory nodeList) public onlyOwner {
        require(nodes.length == 0, 'already-initialized');
        for (uint i = 0; i < nodeList.length; i++) {
            addNewNode(nodeList[i]);
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

    // proposal type 1: switch to a new set of proposers
    function proposeNewProposers(address[] calldata newProposers) public onlyProposer {
        require(newProposers.length > 0, 'no-new-proposers');
        require(newProposers.length <= 256, 'too-many-proposers');
        proposals.push(Proposal(msg.sender, newProposers, NodeInfo(0,'','',''), 0, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeNewProposers(id, msg.sender, newProposers);
    }

    // proposal type 2: add a new smartbchd node
    function proposeNewNode(bytes32 pubkeyHash, bytes32 rpcUrl, bytes32 intro) public onlyProposer {
        NodeInfo memory node = NodeInfo(0, pubkeyHash, rpcUrl, intro);
        proposals.push(Proposal(msg.sender, new address[](0), node, 0, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeNewNode(id, msg.sender, pubkeyHash, rpcUrl, intro);
    }

    // proposal type 3: remove a smartbchd node
    function proposeObsoleteNode(uint nodeId) public onlyProposer {
        uint nodeIdx = nodeIdxById[nodeId];
        require(nodeIdx < nodes.length && nodes[nodeIdx].id == nodeId, 'no-such-node');

        proposals.push(Proposal(msg.sender, new address[](0), NodeInfo(0,'','',''), nodeId, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeObsoleteNode(id, msg.sender, nodeId);
    }

    // vote for a pending proposal
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

    // when the operator set changes, anyone can use this function to sync the proposer set to this operator set.
    function syncProposers() public {
        ICCOperatorsGov opGov = ICCOperatorsGov(OPERATORS_GOV_ADDR);
        address[] memory addrList = opGov.operatorAddrList();
        bytes32 hash = keccak256(abi.encode(addrList));
        if(syncProposersHash == hash) { //when the operator set changes, the resyncing will only happen once
            return; // already synced before, do nothing
        }
        syncProposersHash = hash;
        clearOldProposers();
        setNewProposers(addrList);
        minProposalId = proposals.length;
    }

    // if 2/3 of the proposers agree with a proposal, anyone can execute this proposal
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
        } else if (proposal.newNode.pubkeyHash > 0) {
            addNewNode(proposal.newNode);
        } else {
            assert(proposal.obsoleteNodeId > 0); // nodeId starts from 1
            removeNodeById(proposal.obsoleteNodeId);
        }
        delete proposals[id];
        emit ExecProposal(id);
    }

    function addNewNode(NodeInfo memory node) private {
        node.id = ++lastNodeId; // assign a unique id
        nodes.push(node);
        nodeIdxById[node.id] = nodes.length - 1; // maintain the id-to-index map
    }

    // a monitor can remove a node immediately without voting
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
    // clear the variable 'proposerIdxByAddr' and 'proposers'
    function clearOldProposers() private {
        for (uint i = proposers.length; i > 0; i--) {
            delete proposerIdxByAddr[proposers[i - 1]];
            proposers.pop();
        }
    }
    // modify the variable 'proposerIdxByAddr' and 'proposers' to add a new proposer
    function setNewProposers(address[] memory newProposers) private {
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

    // from 'nodes' remove an entry whose id is 'nodeId', and shrink 'nodes'
    function removeNodeById(uint nodeId) internal {
        uint nodeIdx = nodeIdxById[nodeId];
        require(nodeIdx < nodes.length && nodes[nodeIdx].id == nodeId,
            'no-such-node');

        uint lastIndex = nodes.length - 1;
        if (nodes.length > 1 && nodeIdx != lastIndex) {
            NodeInfo storage lastNode = nodes[lastIndex];
            nodes[nodeIdx] = lastNode;
            nodeIdxById[lastNode.id] = nodeIdx; // maintain the id-to-index map
        }
        nodes.pop();
        delete nodeIdxById[nodeId];
    }
}

contract CCSbchNodesGovForUT is CCSbchNodesGov {

    constructor(address monitorsGovAddr, address operatorsGovAddr, address[] memory _proposers)
        CCSbchNodesGov(monitorsGovAddr, operatorsGovAddr, _proposers) {}

    function getProposerIdx(address addr) public view returns (uint) {
        return proposerIdxByAddr[addr];
    }
    function getNodeIdx(uint id) public view returns (uint) {
        return nodeIdxById[id];
    }

}

contract CCSbchNodesGovForIntegrationTest is CCSbchNodesGov {

    constructor() CCSbchNodesGov(address(0x0), address(0x0), new address[](1)) {}

    function addNode(bytes32 pubkeyHash,
                     bytes32 rpcUrl,
                     bytes32 intro) public {
        uint id = nodes.length + 1;
        nodes.push(NodeInfo(id, pubkeyHash, rpcUrl, intro));
        nodeIdxById[id] = id - 1;
    }

    function delNode(uint id) public {
        removeNodeById(id);
    }

}

