//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";

contract CCVoting2 {

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


	function applyMonitor(uint8 pubkeyPrefix,
		                  bytes32 pubkeyX,
		                  bytes32 rpcUrl, 
		                  bytes32 intro) public payable {
		require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
		require(msg.value >= MONITOR_INIT_STAKE, 'deposit-too-less');
		require(monitorIdxByAddr[msg.sender] == 0, 'monitor-existed');
		monitors.push(OperatorOrMonitorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0));
		stakeById[++lastStakeId] = StakeInfo(msg.sender, msg.sender, address(0), uint32(block.timestamp), msg.value);
		stakeIdsByAddr[msg.sender].push(lastStakeId);
	}

	function applyOperator(uint8 pubkeyPrefix,
		                  bytes32 pubkeyX,
		                  bytes32 rpcUrl, 
		                  bytes32 intro) public payable {
		require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
		require(msg.value >= OPERATOR_INIT_STAKE, 'deposit-too-less');
		require(operatorIdxByAddr[msg.sender] == 0, 'operator-existed');
		operators.push(OperatorOrMonitorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0));
		stakeById[++lastStakeId] = StakeInfo(msg.sender, address(0), msg.sender, uint32(block.timestamp), msg.value);
		stakeIdsByAddr[msg.sender].push(lastStakeId);
	}

	function stakeMonitor(address addr) public payable {
		require(msg.value > 0, 'staked-nothing');
		stakeById[++lastStakeId] = StakeInfo(msg.sender, addr, address(0), uint32(block.timestamp), msg.value);
		stakeIdsByAddr[msg.sender].push(lastStakeId);

		uint monitorIdx = monitorIdxByAddr[addr];
		OperatorOrMonitorInfo storage monitor = monitors[monitorIdx];
		require(monitor.addr == addr, 'no-such-monitor');
		monitor.totalStakedAmt += msg.value;
		if (addr == msg.sender) {
			monitor.selfStakedAmt += msg.value;
		}
	}

	function stakeOperator(address addr) public payable {
		require(msg.value > 0, 'staked-nothing');
		stakeById[++lastStakeId] = StakeInfo(msg.sender, address(0), addr, uint32(block.timestamp), msg.value);
		stakeIdsByAddr[msg.sender].push(lastStakeId);

		uint operatorIdx = operatorIdxByAddr[addr];
		OperatorOrMonitorInfo storage operator = operators[operatorIdx];
		require(operator.addr == addr, 'no-such-operator');
		operator.totalStakedAmt += msg.value;
		if (addr == msg.sender) {
			operator.selfStakedAmt += msg.value;
		}
	}

	function unstake(uint stakeId, uint amt) public {
		StakeInfo storage stakeInfo = stakeById[stakeId];
		require(stakeInfo.stakedAmt >= amt, 'insufficient-amt');
		require(stakeInfo.stakedTime + MONITOR_MIN_STAKE_PERIOD < block.timestamp, 'not-mature');
		stakeInfo.stakedAmt -= amt;
		if (stakeInfo.stakedAmt == 0) {
			delete stakeById[stakeId];
			// TODO: delete stakeId from stakeIdsByAddr
		}

		if (stakeInfo.monitor != address(0)) {
			_unstakeMonitor(stakeInfo.monitor, amt);
		} else {
			_unstakeOperator(stakeInfo.operator, amt);
		}

		Address.sendValue(payable(msg.sender), amt);
	}

	function _unstakeMonitor(address monitorAddr, uint amt) private {
		uint monitorIdx = monitorIdxByAddr[monitorAddr];
		OperatorOrMonitorInfo storage monitor = monitors[monitorIdx];
		require(monitor.addr != address(0), 'no-such-monitor');
		monitor.totalStakedAmt -= amt;
		if (monitor.addr == msg.sender) {
			monitor.selfStakedAmt -= amt;
		}
	}

	function _unstakeOperator(address operatorAddr, uint amt) private {
		uint operatorIdx = operatorIdxByAddr[operatorAddr];
		OperatorOrMonitorInfo storage operator = operators[operatorIdx];
		require(operator.addr != address(0), 'no-such-operator');
		operator.totalStakedAmt -= amt;
		if (operator.addr == msg.sender) {
			operator.selfStakedAmt -= amt;
		}
	}

}
