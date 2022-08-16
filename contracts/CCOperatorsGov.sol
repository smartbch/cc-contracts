//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
// import "hardhat/console.sol";

contract CCOperatorsGov {

    struct OperatorInfo {
        address addr;           // address
        uint    pubkeyPrefix;   // 0x02 or 0x03
        bytes32 pubkeyX;        // x
        bytes32 rpcUrl;         // ip:port
        bytes32 intro;          // introduction
        uint    totalStakedAmt; // in BCH
        uint    selfStakedAmt;  // in BCH
        uint    electedTime;    // 0 means not elected, set by Golang
    }

    struct StakeInfo {
        address staker;
        address operator;
        uint32  stakedTime;
        uint    stakedAmt;
    }

    event OperatorApply(address indexed candidate, uint pubkeyPrefix, bytes32 pubkeyX, bytes32 rpcUrl, bytes32 intro, uint initStakeAmt);
    event OperatorStake(address indexed candidate, address indexed staker, uint stakeId, uint amt);
    event OperatorUnstake(address indexed candidate, address indexed staker, uint stakeId, uint amt);

    uint public constant MIN_SELF_STAKE_AMT = 10_000 ether;
    uint public constant MIN_STAKE_PERIOD = 100 days;

    OperatorInfo[] public operators; // read by Golang
    mapping(address => uint) operatorIdxByAddr;
    uint[] freeSlots;

    StakeInfo[] public stakeInfos;


    function applyOperator(uint8 pubkeyPrefix,
                           bytes32 pubkeyX,
                           bytes32 rpcUrl, 
                           bytes32 intro) public payable {
        require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
        require(msg.value >= MIN_SELF_STAKE_AMT, 'deposit-too-less');

        uint operatorIdx = operatorIdxByAddr[msg.sender];
        require(operatorIdx == 0, 'operator-existed');
        if (operators.length > 0) {            
            require(operators[0].addr != msg.sender, 'operator-existed');
        }

        if (freeSlots.length > 0) {
            uint freeSlot = freeSlots[freeSlots.length - 1];
            freeSlots.pop();
            operators[freeSlot] = OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0);
            operatorIdxByAddr[msg.sender] = freeSlot;
        } else {
            operators.push(OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0));
            operatorIdxByAddr[msg.sender] = operators.length - 1;
        }

        stakeInfos.push(StakeInfo(msg.sender, msg.sender, uint32(block.timestamp), msg.value));
        emit OperatorApply(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value);
        emit OperatorStake(msg.sender, msg.sender, stakeInfos.length - 1, msg.value); 
    }

    function stakeOperator(address addr) public payable {
        require(msg.value > 0, 'deposit-nothing');
        stakeInfos.push(StakeInfo(msg.sender, addr, uint32(block.timestamp), msg.value));

        uint operatorIdx = operatorIdxByAddr[addr];
        OperatorInfo storage operator = operators[operatorIdx];
        require(operator.addr == addr, 'no-such-operator');
        operator.totalStakedAmt += msg.value;
        if (addr == msg.sender) {
            operator.selfStakedAmt += msg.value;
        }
        emit OperatorStake(operator.addr, msg.sender, stakeInfos.length - 1, msg.value);
    }

    function unstakeOperator(uint stakeId, uint amt) public {
        require(stakeId < stakeInfos.length, 'no-such-stake-info');
        StakeInfo storage stakeInfo = stakeInfos[stakeId];
        require(stakeInfo.staker == msg.sender, 'not-your-stake');
        require(stakeInfo.stakedAmt >= amt, 'withdraw-too-much');
        require(stakeInfo.stakedTime + MIN_STAKE_PERIOD < block.timestamp, 'not-mature');

        uint operatorIdx = operatorIdxByAddr[stakeInfo.operator];
        OperatorInfo storage operator = operators[operatorIdx];
        require(operator.addr != address(0), 'no-such-operator'); // unreachable

        operator.totalStakedAmt -= amt;
        if (operator.addr == msg.sender) {
            operator.selfStakedAmt -= amt;
            if (operator.electedTime > 0) {
                require(operator.selfStakedAmt > MIN_SELF_STAKE_AMT, 'too-less-self-stake');
            }
        }
        if (operator.totalStakedAmt == 0) {
            delete operators[operatorIdx];
            delete operatorIdxByAddr[msg.sender];
            freeSlots.push(operatorIdx);
        }

        stakeInfo.stakedAmt -= amt;
        if (stakeInfo.stakedAmt == 0) {
            delete stakeInfos[stakeId];
        }

        Address.sendValue(payable(msg.sender), amt);
        emit OperatorUnstake(operator.addr, msg.sender, stakeId, amt);
    }

}


contract CCOperatorsGovForTest is CCOperatorsGov {

    function addOperator(uint pubkeyPrefix,
                         bytes32 pubkeyX,
                         bytes32 rpcUrl, 
                         bytes32 intro,
                         uint totalStakedAmt,
                         uint selfStakedAmt) public {
        operators.push(OperatorInfo(msg.sender, 
            pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, 0));
    }
    function removeLastOperator() public {
    	operators.pop();
    }

}

contract CCOperatorsGovForUT is CCOperatorsGov {

    function setElectedTime(uint opIdx, uint ts) public {
        operators[opIdx].electedTime = ts;
    }

}
