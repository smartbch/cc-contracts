//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
// import "hardhat/console.sol";

interface ICCOperatorsGov {

    function isOperator(address addr) external view returns (bool);
    function operatorAddrList() external view returns (address[] memory);

}

struct OperatorInfo {
    address addr;           // address
    uint    pubkeyPrefix;   // 0x02 or 0x03
    bytes32 pubkeyX;        // the x coordinate of the pubkey
    bytes32 rpcUrl;         // ip:port
    bytes32 intro;          // introduction
    uint    totalStakedAmt; // total staked BCH
    uint    selfStakedAmt;  // self staked BCH
    uint    electedTime;    // 0 means not elected, set by Golang logic after counting votes
    uint    oldElectedTime; // used to get the previous quorem operators, set by Golang logic
}

struct StakeInfo {
    address staker;
    address operator;
    uint32  stakedTime;
    uint    stakedAmt;
}

contract CCOperatorsGov is ICCOperatorsGov, Ownable {
    using SafeERC20 for IERC20;

    // emitted when someone apply for the job as an operator
    event OperatorApply(address indexed candidate, uint pubkeyPrefix, bytes32 pubkeyX, bytes32 rpcUrl, bytes32 intro, uint stakedAmt);
    // emitted when someone stake BCH to an operator candidate
    event OperatorStake(address indexed candidate, address indexed staker, uint stakeId, uint amt);
    // emitted when someone unstake BCH from an operator candidate
    event OperatorUnstake(address indexed candidate, address indexed staker, uint stakeId, uint amt);

    address constant private SEP206_ADDR = address(uint160(0x2711));

    uint constant MIN_SELF_STAKED_AMT = 10_000 ether; // TODO: change this
    uint constant MIN_STAKING_PERIOD = 100 days;      // TODO: change this

    OperatorInfo[] public operators; // read&written by Golang
    mapping(address => uint) operatorIdxByAddr;
    uint[] freeSlots;

    StakeInfo[] public stakeInfos; // each stake action is recorded, such that the staker can unstake it

    function init(OperatorInfo[] memory opList) public onlyOwner {
        require(operators.length == 0, 'already-initialized');    

        for (uint i = 0; i < opList.length; i++) {
            OperatorInfo memory operator = opList[i];

            require(operator.selfStakedAmt >= MIN_SELF_STAKED_AMT, 'staked-too-less');
            IERC20(SEP206_ADDR).safeTransferFrom(
                operator.addr, address(this), operator.selfStakedAmt);

            operator.electedTime = block.timestamp;
            operator.oldElectedTime = 0;
            operator.totalStakedAmt = operator.selfStakedAmt;

            operatorIdxByAddr[operator.addr] = operators.length;
            operators.push(operator);
        }
    }

    function operatorAddrList() external view override returns (address[] memory) {
        address[] memory addrList = new address[](operators.length);
        uint electedCount = 0;
        for(uint i=0; i<addrList.length; i++) {
            bool elected = operators[i].electedTime>0;
            if(elected) {
                addrList[electedCount] = operators[i].addr;
                electedCount++;
            }
        }
        // return addrList[0:electedCount];
        uint byteCount = 64 + 32 * electedCount;
        assembly { // slicing addrList
            let lengthPos := add(addrList, 32)
            mstore(lengthPos, electedCount)
            return(addrList, byteCount)
        }
    }

    function isOperator(address addr) external view override returns (bool) {
        if (operators.length == 0) {
            return false;
        }

        uint idx = operatorIdxByAddr[addr];
        OperatorInfo storage info = operators[idx];
        return info.addr == addr && info.electedTime > 0;
    }

    function applyOperator(uint8 pubkeyPrefix,
                           bytes32 pubkeyX,
                           bytes32 rpcUrl, 
                           bytes32 intro) public payable {
        // require(operators.length > 0, 'not-initialized');
        require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
        require(msg.value >= MIN_SELF_STAKED_AMT, 'deposit-too-less');

        uint operatorIdx = operatorIdxByAddr[msg.sender];
        require(operatorIdx == 0, 'operator-existed');
        if (operators.length > 0) {            
            require(operators[0].addr != msg.sender, 'operator-existed');
        }

        if (freeSlots.length > 0) {
            uint freeSlot = freeSlots[freeSlots.length - 1];
            freeSlots.pop();
            operators[freeSlot] = OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0, 0);
            operatorIdxByAddr[msg.sender] = freeSlot;
        } else {
            operators.push(OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0, 0));
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
        require(stakeInfo.stakedTime + MIN_STAKING_PERIOD < block.timestamp, 'not-mature');

        uint operatorIdx = operatorIdxByAddr[stakeInfo.operator];
        OperatorInfo storage operator = operators[operatorIdx];
        require(operator.addr != address(0), 'no-such-operator'); // unreachable

        stakeInfo.stakedAmt -= amt;
        if (stakeInfo.stakedAmt == 0) {
            delete stakeInfos[stakeId];
        }

        operator.totalStakedAmt -= amt;
        if (operator.addr == msg.sender) {
            operator.selfStakedAmt -= amt;
            if (operator.electedTime > 0) {
                require(operator.selfStakedAmt > MIN_SELF_STAKED_AMT, 'too-less-self-stake');
            }
        }
        if (operator.totalStakedAmt == 0) {
            delete operators[operatorIdx];
            delete operatorIdxByAddr[msg.sender];
            freeSlots.push(operatorIdx);
        }

        Address.sendValue(payable(msg.sender), amt);
        emit OperatorUnstake(operator.addr, msg.sender, stakeId, amt);
    }

}


contract CCOperatorsGovForStorageTest is CCOperatorsGov {

    // constructor(OperatorInfo[] memory opList) CCOperatorsGov(opList) {}

    function addOperator(uint pubkeyPrefix,
                         bytes32 pubkeyX,
                         bytes32 rpcUrl, 
                         bytes32 intro,
                         uint totalStakedAmt,
                         uint selfStakedAmt) public {
        operators.push(OperatorInfo(msg.sender, 
            pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, 0, 0));
    }

    function removeLastOperator() public {
        operators.pop();
    }

}

contract CCOperatorsGovForUT is CCOperatorsGov {

    // constructor(OperatorInfo[] memory opList) CCOperatorsGov(opList) {}

    function getOperatorIdx(address addr) public view returns (uint) {
        return operatorIdxByAddr[addr];
    }
    function getFreeSlots() public view returns (uint[] memory) {
        return freeSlots;
    }

    function setElectedTime(uint opIdx, uint ts) public {
        operators[opIdx].electedTime = ts;
    }

}

contract CCOperatorsGovForIntegrationTest is CCOperatorsGov {

    // constructor(OperatorInfo[] memory opList) CCOperatorsGov(opList) {}

    function addOperator(address addr,
                         bytes calldata pubkey,
                         bytes32 rpcUrl, 
                         bytes32 intro,
                         uint totalStakedAmt,
                         uint selfStakedAmt,
                         uint electedTime) public {
        require(pubkey.length == 33, 'invalid-pubkey');
        uint pubkeyPrefix = uint(uint8(pubkey[0]));
        bytes32 pubkeyX = bytes32(pubkey[1:]);

        if (operators.length > 0) {
          uint idx = operatorIdxByAddr[addr];
          require(operators[idx].addr != addr, 'existed-operator');
        }

        operators.push(OperatorInfo(addr, pubkeyPrefix, pubkeyX,
            rpcUrl, intro, totalStakedAmt, selfStakedAmt, electedTime, 0));
        operatorIdxByAddr[addr] = operators.length - 1;
    }

    function updateOperator(address addr,
                         bytes calldata pubkey,
                         uint totalStakedAmt,
                         uint selfStakedAmt,
                         uint electedTime) public {
        require(pubkey.length == 33, 'invalid-pubkey');
        uint pubkeyPrefix = uint(uint8(pubkey[0]));
        bytes32 pubkeyX = bytes32(pubkey[1:]);

        uint idx = operatorIdxByAddr[addr];
        require(operators[idx].addr == addr, 'no-such-operator');
        bytes32 rpcUrl = operators[idx].rpcUrl;
        bytes32 intro = operators[idx].intro;

        operators[idx]= OperatorInfo(addr, pubkeyPrefix, pubkeyX,
            rpcUrl, intro, totalStakedAmt, selfStakedAmt, electedTime, 0);
    }

}
