//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
// import "hardhat/console.sol";

interface ICCMonitorsGov {

    function isMonitor(address addr) external view returns (bool);

}

contract CCMonitorsGov is ICCMonitorsGov {

    struct MonitorInfo {
        address addr;         // address
        uint    pubkeyPrefix; // 0x02 or 0x03
        bytes32 pubkeyX;      // x
        bytes32 intro;        // introduction
        uint    stakedAmt;    // in BCH
        uint    electedTime;  // 0 means not elected, set by Golang
    }

    event MonitorApply(address indexed candidate, uint pubkeyPrefix, bytes32 pubkeyX, bytes32 intro, uint stakedAmt);
    event MonitorStake(address indexed candidate, uint amt);
    event MonitorUnstake(address indexed candidate, uint amt);

    uint constant MIN_STAKED_AMT = 100_000 ether; // TODO: change this
    uint constant UNSTAKE_WINDOW = 10 days;       // TODO: change this

    uint public lastElectionTime;  // set by Golang
    MonitorInfo[] public monitors; // read by Golang
    mapping(address => uint) monitorIdxByAddr;
    uint[] freeSlots;

    function isMonitor(address addr) external view override returns (bool) {
        if (monitors.length == 0) {
            return false;
        }

        uint idx = monitorIdxByAddr[addr];
        MonitorInfo storage info = monitors[idx];
        return info.addr == addr && info.electedTime > 0;
    }

    function applyMonitor(uint8 pubkeyPrefix,
                          bytes32 pubkeyX,
                          bytes32 intro) public payable {
        require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
        require(msg.value >= MIN_STAKED_AMT, 'deposit-too-less');

        uint monitorIdx = monitorIdxByAddr[msg.sender];
        require(monitorIdx == 0, 'monitor-existed');
        if (monitors.length > 0) {            
            require(monitors[0].addr != msg.sender, 'monitor-existed');
        }

        if (freeSlots.length > 0) {
            uint freeSlot = freeSlots[freeSlots.length - 1];
            freeSlots.pop();
            monitors[freeSlot] = MonitorInfo(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value, 0);
            monitorIdxByAddr[msg.sender] = freeSlot;
        } else {
            monitors.push(MonitorInfo(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value, 0));
            monitorIdxByAddr[msg.sender] = monitors.length - 1;
        }

        emit MonitorApply(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value);
    }

    function addStake() public payable {
        require(monitors.length > 0, 'not-monitor');
        uint monitorIdx = monitorIdxByAddr[msg.sender];
        MonitorInfo storage monitor = monitors[monitorIdx];
        require(monitor.addr == msg.sender, 'not-monitor');
        require(msg.value > 0, 'deposit-nothing');
        monitor.stakedAmt += msg.value;
        emit MonitorStake(msg.sender, msg.value);
    }

    function removeStake(uint amt) public {
        require(monitors.length > 0, 'not-monitor');
        uint monitorIdx = monitorIdxByAddr[msg.sender];
        MonitorInfo storage monitor = monitors[monitorIdx];
        require(monitor.addr == msg.sender, 'not-monitor');
        require(monitor.stakedAmt >= amt, 'withdraw-too-much');

        monitor.stakedAmt -= amt;
        if (monitor.stakedAmt < MIN_STAKED_AMT) {
            require(monitor.electedTime == 0, 'monitor-is-active');
            require(block.timestamp - lastElectionTime < UNSTAKE_WINDOW, "outside-unstake-window");
            // TODO: more checks
        }
        if (monitor.stakedAmt == 0) {
            delete monitors[monitorIdx];
            delete monitorIdxByAddr[msg.sender];
            freeSlots.push(monitorIdx);
        }

        Address.sendValue(payable(msg.sender), amt);
        emit MonitorUnstake(msg.sender, amt);
    }

}


contract CCMonitorsGovForTest is CCMonitorsGov {

    function setLastElectionTime(uint ts) public {
        lastElectionTime = ts;
    }

    function addMonitor(uint pubkeyPrefix,
                        bytes32 pubkeyX,
                        bytes32 intro,
                        uint stakedAmt) public {
        monitors.push(MonitorInfo(msg.sender, 
            pubkeyPrefix, pubkeyX, intro, stakedAmt, 0));
    }

}

contract CCMonitorsGovForUT is CCMonitorsGov {

    function getMonitorIdx(address addr) public view returns (uint) {
        return monitorIdxByAddr[addr];
    }
    function getFreeSlots() public view returns (uint[] memory) {
        return freeSlots;
    }

    function setElectedTime(uint idx, uint ts) public {
        monitors[idx].electedTime = ts;
    }

    function setLastElectionTime() public {
        lastElectionTime = block.timestamp;
    }

}
