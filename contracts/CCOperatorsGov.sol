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
        uint addrOrig; // start of returned data
        uint addrLen; // the slice's length is written at this address
        uint addrStart; // the address of the first entry of returned slice
        uint addrEnd; // ending address to write the next operator
        uint count = 0; // the slice's length
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addrOrig := mload(0x40) // There is a “free memory pointer” at address 0x40 in memory
            mstore(addrOrig, 32) //the meaningful data start after offset 32
        }
        addrLen = addrOrig + 32;
        addrStart = addrLen + 32;
        addrEnd = addrStart;
        for(uint i=0; i<operators.length; i++) {
            if(operators[i].electedTime == 0) continue;
            uint operator = uint(uint160(operators[i].addr));
            // solhint-disable-next-line no-inline-assembly
            assembly {
                mstore(addrEnd, operator) //write the operator
            }
            addrEnd += 32;
            count++;
        }
        // solhint-disable-next-line no-inline-assembly
        assembly {
            mstore(addrLen, count) // record the returned slice's length
            let byteCount := sub(addrEnd, addrOrig)
            return(addrOrig, byteCount)
        }
    }

    // check if 'addr' has been elected as an operator
    function isOperator(address addr) external view override returns (bool) {
        if (operators.length == 0) {
            return false;
        }

        uint idx = operatorIdxByAddr[addr];
        OperatorInfo storage info = operators[idx];
        return info.addr == addr && info.electedTime > 0;
    }

    // apply the job as an operator
    function applyOperator(uint8 pubkeyPrefix,
                           bytes32 pubkeyX,
                           bytes32 rpcUrl, 
                           bytes32 intro) public payable {
        // require(operators.length > 0, 'not-initialized');
        require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
        require(msg.value >= MIN_SELF_STAKED_AMT, 'deposit-too-less'); // self stake

        uint operatorIdx = operatorIdxByAddr[msg.sender];
        require(operatorIdx == 0, 'operator-existed'); // zero means not-existed or locate at [0]
        if (operators.length > 0) { // make sure it does not locate at [0]
            require(operators[0].addr != msg.sender, 'operator-existed');
        }

        if (freeSlots.length > 0) { // if the 'operators' list has free slots, i.e., empty slots
            uint freeSlot = freeSlots[freeSlots.length - 1];
            freeSlots.pop();
            operators[freeSlot] = OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0, 0);
            operatorIdxByAddr[msg.sender] = freeSlot;
        } else { // no free slot, so we must enlarge the 'operators' list
            operators.push(OperatorInfo(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value, msg.value, 0, 0));
            operatorIdxByAddr[msg.sender] = operators.length - 1;
        }

        stakeInfos.push(StakeInfo(msg.sender, msg.sender, uint32(block.timestamp), msg.value));
        emit OperatorApply(msg.sender, pubkeyPrefix, pubkeyX, rpcUrl, intro, msg.value);
        emit OperatorStake(msg.sender, msg.sender, stakeInfos.length - 1, msg.value);
    }

    // stake BCH to vote for an operator candidate
    function stakeOperator(address addr) public payable {
        require(msg.value > 0, 'deposit-nothing');
        stakeInfos.push(StakeInfo(msg.sender, addr, uint32(block.timestamp), msg.value));

        uint operatorIdx = operatorIdxByAddr[addr];
        OperatorInfo storage operator = operators[operatorIdx];
        require(operator.addr == addr, 'no-such-operator');
        operator.totalStakedAmt += msg.value;
        if (addr == msg.sender) { // increasing self-stake is allowed
            operator.selfStakedAmt += msg.value;
        }
        emit OperatorStake(operator.addr, msg.sender, stakeInfos.length - 1, msg.value);
    }

    // unstake BCH from a former staking record, to revoke your vote for an operator
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
            delete stakeInfos[stakeId]; // delete an useless slot. This slot will not be used again
        }

        operator.totalStakedAmt -= amt;
        if (operator.addr == msg.sender) { // reduce the recorded self-stake amount
            operator.selfStakedAmt -= amt;
            if (operator.electedTime > 0) { // active operator must keep enough self-stake
                require(operator.selfStakedAmt > MIN_SELF_STAKED_AMT, 'too-less-self-stake');
            }
        }
        if (operator.totalStakedAmt == 0) { // an inactive operator has no staked coins now, we can delete it
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
