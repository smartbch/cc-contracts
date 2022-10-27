//SPDX-License-Identifier: Unlicense
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

    mapping(address => bool) operators;

    function isOperator(address addr) external view override returns (bool) {
        return operators[addr];
    }

    function becomeOperator() public {
        operators[msg.sender] = true;
    }

}
