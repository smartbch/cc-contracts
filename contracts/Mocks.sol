//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import { ICCMonitorsGov } from "./CCMonitorsGov.sol";
import { ICCOperatorsGov } from "./CCOperatorsGov.sol";
// import "hardhat/console.sol";

contract CCMonitorsGovMock is ICCMonitorsGov {

    mapping(address => bool) monitors;

    function isMonitor(address addr) external view override returns (bool) {
        return monitors[addr];
    }

    function becomeMonitor() public {
        monitors[msg.sender] = true;
    }

}

contract CCOperatorsGovMock is ICCOperatorsGov {

    mapping(address => bool) opMap;
    address[] opList;

    function isOperator(address addr) external view override returns (bool) {
        return opMap[addr];
    }

    function operatorAddrList() external view returns (address[] memory) {
        return opList;
    }


    function becomeOperator() public {
        opMap[msg.sender] = true;
    }

}
