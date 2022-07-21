//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract CCOperatorsGovForTest {

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

    function addOperator(uint pubkeyPrefix,
                         bytes32 pubkeyX,
                         bytes32 rpcUrl, 
                         bytes32 intro,
                         uint totalStakedAmt,
                         uint selfStakedAmt) public {
        operators.push(OperatorInfo(msg.sender, 
            pubkeyPrefix, pubkeyX, rpcUrl, intro, totalStakedAmt, selfStakedAmt, 0));
    }

}
