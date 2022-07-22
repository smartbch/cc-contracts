//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract CCVoting1ForTest {

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

	uint currOperatorCount; // set from Go
	OperatorInfo[] operators;
	mapping(address => VoterInfo) voters;

	function addOperator(uint pubkeyPrefix,
		                 bytes32 pubkeyX,
		                 bytes32 rpcUrl, 
		                 bytes32 intro) public {
		operators.push(OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, 0, 0));
	}

	function getOperator(uint idx) public returns (address, uint, bytes32, bytes32, bytes32, uint, uint) {
		OperatorInfo storage operator = operators[idx];
		return (operator.owner, operator.pubkeyPrefix, operator.pubkeyX, operator.rpcUrl, operator.intro, 
			operator.votes, operator.inOfficeStartTime);
	}

}
