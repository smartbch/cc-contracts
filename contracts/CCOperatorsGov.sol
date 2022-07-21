//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";

contract CCOperatorsGov {

    struct OperatorInfo {
        address addr;              // address
        uint    pubkeyPrefix;      // 0x02 or 0x03 (TODO: change type to uint8)
        bytes32 pubkeyX;           // x
        bytes32 rpcUrl;            // ip:port
        bytes32 intro;             // introduction
        uint    totalStakedAmt;    // in BCH
        uint    selfStakedAmt;     // in BCH
        uint    inOfficeStartTime; // 0 means not in office, this field is set from Golang
    }

    struct StakeInfo {
        address staker;
        address operator;
        uint32  stakedTime;
        uint    stakedAmt;
    }

    uint constant OPERATOR_INIT_STAKE = 10_000 ether;
    uint constant OPERATOR_MIN_STAKE_PERIOD = 100 days;

    // read by Golang
    OperatorInfo[] operators;

    mapping(address => uint) operatorIdxByAddr;

    uint lastStakeId;
    mapping(uint => StakeInfo) stakeById;
    mapping(address => uint[]) stakeIdsByAddr;


    function applyOperator(uint8 pubkeyPrefix,
                          bytes32 pubkeyX,
                          bytes32 rpcUrl, 
                          bytes32 intro) public payable {
        require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
        require(msg.value >= OPERATOR_INIT_STAKE, 'deposit-too-less');
        require(operatorIdxByAddr[msg.sender] == 0, 'operator-existed');
        operators.push(OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0));
        stakeById[++lastStakeId] = StakeInfo(msg.sender, msg.sender, uint32(block.timestamp), msg.value);
        stakeIdsByAddr[msg.sender].push(lastStakeId);
    }

    function stakeOperator(address addr) public payable {
        require(msg.value > 0, 'staked-nothing');
        stakeById[++lastStakeId] = StakeInfo(msg.sender, addr, uint32(block.timestamp), msg.value);
        stakeIdsByAddr[msg.sender].push(lastStakeId);

        uint operatorIdx = operatorIdxByAddr[addr];
        OperatorInfo storage operator = operators[operatorIdx];
        require(operator.addr == addr, 'no-such-operator');
        operator.totalStakedAmt += msg.value;
        if (addr == msg.sender) {
            operator.selfStakedAmt += msg.value;
        }
    }

    function unstake(uint stakeId, uint amt) public {
        StakeInfo storage stakeInfo = stakeById[stakeId];
        require(stakeInfo.stakedAmt >= amt, 'insufficient-amt');
        require(stakeInfo.stakedTime + OPERATOR_MIN_STAKE_PERIOD < block.timestamp, 'not-mature');
        stakeInfo.stakedAmt -= amt;
        if (stakeInfo.stakedAmt == 0) {
            delete stakeById[stakeId];
            // TODO: delete stakeId from stakeIdsByAddr
        }

        _unstakeOperator(stakeInfo.operator, amt);
        Address.sendValue(payable(msg.sender), amt);
    }

    function _unstakeOperator(address operatorAddr, uint amt) private {
        uint operatorIdx = operatorIdxByAddr[operatorAddr];
        OperatorInfo storage operator = operators[operatorIdx];
        require(operator.addr != address(0), 'no-such-operator');
        operator.totalStakedAmt -= amt;
        if (operator.addr == msg.sender) {
            operator.selfStakedAmt -= amt;
        }
    }

}
