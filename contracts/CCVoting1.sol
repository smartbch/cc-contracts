//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";

contract CCVoting1 {

	struct OperatorInfo {
		address owner;
		uint    pubkeyPrefix; // 0x02 or 0x03 (TODO: change type to uint8)
		bytes32 pubkeyX;      // x
		bytes32 rpcUrl;       // ip:port
		bytes32 intro;
		uint    votes;
		uint    inOfficeStartTime; // 0 means not in office
	}

	struct VoterInfo {
		uint lastUpdatedTime;
		uint coinDays;
		uint stakedAmount;
	}

	address immutable MONITOR_ADDR;
	uint constant OPERATOR_STAKING_AMT = 5000 ether;
	uint constant MIN_OPERATOR_VOTING_COINDAYS = 100000 ether * 24 * 3600;
	uint constant MAX_OPERATORS = 10;

	uint currOperatorCount; // set from Go
	OperatorInfo[] operators;
	mapping(address => VoterInfo) voters;

	constructor(address monitorAddr) {
		MONITOR_ADDR = monitorAddr;
	}

	function operatorDeposit(uint pubkeyPrefix,
		                     bytes32 pubkeyX,
		                     bytes32 rpcUrl, 
		                     bytes32 intro) public payable {
		require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
		require(msg.value == OPERATOR_STAKING_AMT, 'wrong-deposit-value');
		for (uint i = 0; i < operators.length; i++) {
			require(operators[i].pubkeyPrefix != pubkeyPrefix || operators[i].pubkeyX == pubkeyX,
				'pubkey-existed');
		}
		operators.push(OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, 0, 0));
	}

	function operatorWithdraw() public {
		uint operatorIdx = findOperatorIdx(msg.sender);
		OperatorInfo storage operator = operators[operatorIdx];
		require(operator.inOfficeStartTime == 0, 'still-in-office');
		operators[operatorIdx] = operators[operators.length - 1];
		operators.pop();
		Address.sendValue(payable(msg.sender), OPERATOR_STAKING_AMT);
	}

	function voterDeposit() public payable {
		require(msg.value > 0, 'deposit-zero');
		VoterInfo storage voter = voters[msg.sender];
		if (voter.stakedAmount > 0) {
			updateCoinDays(voter);
			voter.stakedAmount += msg.value;
		} else { // init voter
			voter.stakedAmount = msg.value;
			voter.lastUpdatedTime = block.timestamp;
		}
	}

	function voterWithdraw(uint amount) public {
		require(amount > 0, 'withdraw-zero');
		VoterInfo storage voter = voters[msg.sender];
		require(voter.stakedAmount > amount, 'withdraw-too-much');
		updateCoinDays(voter);
		voter.stakedAmount -= amount;
		Address.sendValue(payable(msg.sender), amount);
	}

	function voteOperator(address owner) public {
		VoterInfo storage voter = voters[msg.sender];
		require(voter.stakedAmount > 0, 'no-such-voter');
		updateCoinDays(voter);
		require(voter.coinDays > MIN_OPERATOR_VOTING_COINDAYS, 'not-enough-coindays');

		uint operatorIdx = findOperatorIdx(owner);
		OperatorInfo storage operator = operators[operatorIdx];

		if (currOperatorCount == 0) {
			currOperatorCount = getCurrOperatorCount();
		}
		if (currOperatorCount < MAX_OPERATORS) {
			require(operator.inOfficeStartTime == 0, 'no-need-to-vote');
		}

		operator.votes += voter.coinDays;
		voter.coinDays = 0; // clear coinDays
	}

	function updateCoinDays(VoterInfo storage voter) private {
		uint timeElapsed = block.timestamp - voter.lastUpdatedTime;
		voter.coinDays = voter.stakedAmount * timeElapsed;
		voter.lastUpdatedTime = block.timestamp;
	}

	function findOperatorIdx(address owner) private view returns (uint) {
		for (uint i = 0; i < operators.length; i++) {
			if (operators[i].owner == owner) {
				return i;
			}
		}
		require(false, 'operator-not-found');
	}

	function getCurrOperatorCount() private returns (uint) {
		uint n = 0;
		for (uint i = 0; i < operators.length; i++) {
			if (operators[i].inOfficeStartTime > 0) {
				return n++;
			}
		}
		return n;
	}

}
