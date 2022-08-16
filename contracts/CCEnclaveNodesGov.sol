//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

contract CCEnclaveNodesGov {

    struct EnclaveNodeInfo {
        uint id; // start from 1
        bytes information; // JSON
        bytes32 rpcUrl;
        bytes32 introduction;
    }

    struct Proposal {
        address proposer;
        address[] newProposers;  // proposal for new proposer set
        EnclaveNodeInfo newNode; // proposal for new enclave node
        uint obsoleteNodeId;     // proposal for obsolete enclave node
        uint votes; // bitmap
    }

    event ProposeNewProposers(uint indexed id, address indexed proposer, address[] newProposers);
    event ProposeNewNode     (uint indexed id, address indexed proposer, bytes information, bytes32 rpcUrl, bytes32 introduction);
    event ProposeObsoleteNode(uint indexed id, address indexed proposer, uint nodeId);
    event VoteProposal       (uint indexed id, address indexed voter, bool agreed);
    event ExecProposal       (uint indexed id);

    address[] public proposers;
    mapping(address => uint) private proposerSlots; // index+1 is stored actually

    uint public lastNodeId;
    EnclaveNodeInfo[] public nodes;
    mapping(uint => uint) nodeSlotById; // nodeId => nodeIdx+1

    uint public minProposalId;
    Proposal[] public proposals;

    modifier onlyProposer() {
        require(proposerSlots[msg.sender] > 0, 'not-proposer');
        _;
    }

    constructor(address[] memory _proposers) {
        require(_proposers.length > 0, 'no-proposers');
        require(_proposers.length <= 256, 'too-many-proposers');
        for (uint i = 0; i < _proposers.length; i++) {
            setNewProposer(_proposers[i], i);
        }
    }

    function getAllProposers() public view returns (address[] memory _proposers) {
        _proposers = proposers;
    }
    function getProposal(uint id) public view returns (address proposer,
                                                       address[] memory newProposers,
                                                       EnclaveNodeInfo memory newNode,
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
        proposals.push(Proposal(msg.sender, newProposers, EnclaveNodeInfo(0,'','',''), 0, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeNewProposers(id, msg.sender, newProposers);
    }

    function proposeNewNode(bytes calldata information, bytes32 rpcUrl, bytes32 introduction) public onlyProposer {
        require(information.length != 0, 'invalid-info');
        EnclaveNodeInfo memory node = EnclaveNodeInfo(0, information, rpcUrl, introduction);
        proposals.push(Proposal(msg.sender, new address[](0), node, 0, 0));
        uint id = proposals.length - 1;
        _vote(id, true);
        emit ProposeNewNode(id, msg.sender, information, rpcUrl, introduction);
    }

    function proposeObsoleteNode(uint nodeId) public onlyProposer {
        require(nodeSlotById[nodeId] > 0, 'no-such-node');
        proposals.push(Proposal(msg.sender, new address[](0), EnclaveNodeInfo(0,'','',''), nodeId, 0));
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
        uint idx = proposerSlots[msg.sender] - 1;
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
        } else if (proposal.newNode.information.length > 0) {
            EnclaveNodeInfo storage node = proposal.newNode;
            node.id = ++lastNodeId;
            nodes.push(node);
            nodeSlotById[node.id] = nodes.length;
            delete proposals[id];
        } else {
            uint nodeIdx = nodeSlotById[proposal.obsoleteNodeId] - 1;
            nodes[nodeIdx] = nodes[nodes.length - 1];
            nodes.pop();
            delete proposals[id];
        }

        emit ExecProposal(id);
    }

    function getVoteCount(uint votes) private pure returns (uint n) {
        while (votes > 0) {
            n += votes & 1;
            votes >>= 1;
        }
    }
    function clearOldProposers() private {
        for (uint i = proposers.length; i > 0; i--) {
            delete proposerSlots[proposers[i - 1]];
            proposers.pop();
        }
    }
    function setNewProposers(address[] storage newProposers) private {
        for (uint i = 0; i < newProposers.length; i++) {
            setNewProposer(newProposers[i], i);
        }
    }
    function setNewProposer(address proposer, uint idx) private {
        require(proposerSlots[proposer] == 0, 'duplicated-proposer');
        proposerSlots[proposer] = idx + 1;
        proposers.push(proposer);
    }

}
