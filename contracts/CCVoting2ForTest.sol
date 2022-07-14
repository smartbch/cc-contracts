//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract CCVoting2ForTest {

	struct OperatorOrMonitorInfo {
		address addr;              // address
		uint    pubkeyPrefix;      // 0x02 or 0x03 (TODO: change type to uint8)
		bytes32 pubkeyX;           // x
		bytes32 rpcUrl;            // ip:port (not used by monitors)
		bytes32 intro;             // introduction
		uint    totalStakedAmt;    // in BCH
		uint    selfStakedAmt;     // in BCH
		uint    inOfficeStartTime; // 0 means not in office, this field is set from Golang
	}

	struct StakeInfo {
		address staker;
		address monitor;
		address operator;
		uint32  stakedTime;
		uint    stakedAmt;
	}

	uint constant MONITOR_INIT_STAKE = 100_000 ether;
	uint constant OPERATOR_INIT_STAKE = 10_000 ether;
	uint constant MONITOR_MIN_STAKE_PERIOD = 200 days;
	uint constant OPERATOR_MIN_STAKE_PERIOD = 100 days;

	// read by Golang
	OperatorOrMonitorInfo[] monitors;
	OperatorOrMonitorInfo[] operators;

	mapping(address => uint) monitorIdxByAddr;
	mapping(address => uint) operatorIdxByAddr;

	uint lastStakeId;
	mapping(uint => StakeInfo) stakeById;
	mapping(address => uint[]) stakeIdsByAddr;

	function addMonitor(uint pubkeyPrefix,
		                bytes32 pubkeyX,
		                bytes32 rpcUrl, 
		                bytes32 intro,
		                uint totalStakedAmt,
		                uint selfStakedAmt) public {
		monitors.push(OperatorOrMonitorInfo(msg.sender, 
			pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, 0));
	}

	function addOperator(uint pubkeyPrefix,
		                 bytes32 pubkeyX,
		                 bytes32 rpcUrl, 
		                 bytes32 intro,
		                 uint totalStakedAmt,
		                 uint selfStakedAmt) public {
		operators.push(OperatorOrMonitorInfo(msg.sender, 
			pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, 0));
	}

}
