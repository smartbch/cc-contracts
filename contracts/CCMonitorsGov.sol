//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import { ICCOperatorsGov } from "./CCOperatorsGov.sol";
// import "hardhat/console.sol";

interface ICCMonitorsGov {

    function isMonitor(address addr) external view returns (bool);

}

contract CCMonitorsGov is ICCMonitorsGov {

    struct MonitorInfo {
        address   addr;           // address
        uint      pubkeyPrefix;   // 0x02 or 0x03
        bytes32   pubkeyX;        // x
        bytes32   intro;          // introduction
        uint      stakedAmt;      // staked BCH
        uint      electedTime;    // 0 means not elected, set by Golang
        uint      oldElectedTime; // used to get old monitors, set by Golang
        address[] nominatedBy;    // length of nominatedBy is read by Golang
    }

    event MonitorApply(address indexed candidate, uint pubkeyPrefix, bytes32 pubkeyX, bytes32 intro, uint stakedAmt);
    event MonitorStake(address indexed candidate, uint amt);
    event MonitorUnstake(address indexed candidate, uint amt);
    event NominatedBy(address indexed candidate, address operator);

    uint constant MIN_STAKED_AMT = 100_000 ether; // TODO: change this
    uint constant UNSTAKE_WINDOW = 10 days;       // TODO: change this

    address immutable OPERATORS_GOV_ADDR;

    uint public lastElectionTime;  // set by Golang
    MonitorInfo[] public monitors; // read by Golang
    mapping(address => uint) monitorIdxByAddr;
    uint[] freeSlots;

    constructor(address operatorsGovAddr) {
        OPERATORS_GOV_ADDR = operatorsGovAddr;
    }

    modifier onlyOperator() {
        require(ICCOperatorsGov(OPERATORS_GOV_ADDR).isOperator(msg.sender), 'not-operator');
        _;
    }

    function getNominatedBy(address addr) public view returns (address[] memory) {
        (MonitorInfo storage monitor,) = loadMonitorInfo(addr);
        return monitor.nominatedBy;
    }

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
            monitors[freeSlot] = MonitorInfo(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value, 0, 0, new address[](0));
            monitorIdxByAddr[msg.sender] = freeSlot;
        } else {
            monitors.push(MonitorInfo(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value, 0, 0, new address[](0)));
            monitorIdxByAddr[msg.sender] = monitors.length - 1;
        }

        emit MonitorApply(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value);
    }

    function addStake() public payable {
        (MonitorInfo storage monitor,) = loadMonitorInfo(msg.sender);
        require(msg.value > 0, 'deposit-nothing');
        monitor.stakedAmt += msg.value;
        emit MonitorStake(msg.sender, msg.value);
    }

    function removeStake(uint amt) public {
        (MonitorInfo storage monitor, uint monitorIdx) = loadMonitorInfo(msg.sender);
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

    function nominateMonitor(address addr) public onlyOperator {
        (MonitorInfo storage monitor,) = loadMonitorInfo(addr);

        for (uint i = 0; i < monitor.nominatedBy.length; i++) {
            require(monitor.nominatedBy[i] != msg.sender, 'already-nominated');
        }

        monitor.nominatedBy.push(msg.sender);
        emit NominatedBy(addr, msg.sender);
    }

    function loadMonitorInfo(address addr) private view returns (
            MonitorInfo storage monitor, uint monitorIdx) {

        require(monitors.length > 0, 'not-monitor');
        monitorIdx = monitorIdxByAddr[addr];
        monitor = monitors[monitorIdx];
        require(monitor.addr == addr, 'not-monitor');
    }

}


contract CCMonitorsGovForStorageTest is CCMonitorsGov(address(0x0)) {

    function setLastElectionTime(uint ts) public {
        lastElectionTime = ts;
    }

    function addMonitor(uint pubkeyPrefix,
                        bytes32 pubkeyX,
                        bytes32 intro,
                        uint stakedAmt,
                        uint nominatedCount) public {
        monitors.push(MonitorInfo(msg.sender, 
            pubkeyPrefix, pubkeyX, intro, stakedAmt, 0, 0,
            new address[](nominatedCount)));
    }

}

contract CCMonitorsGovForUT is CCMonitorsGov {

    constructor(address operatorsGovAddr) CCMonitorsGov(operatorsGovAddr) {}

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

contract CCMonitorsGovForIntegrationTest is CCMonitorsGov(address(0x0)) {

    function setLastElectionTime(uint ts) public {
        lastElectionTime = ts;
    }

    function addMonitor(address addr,
                        bytes calldata pubkey,
                        bytes32 intro,
                        uint stakedAmt,
                        uint electedTime) public {
        require(pubkey.length == 33, 'invalid-pubkey');
        uint pubkeyPrefix = uint(uint8(pubkey[0]));
        bytes32 pubkeyX = bytes32(pubkey[1:]);

        if (monitors.length > 0) {
          uint idx = monitorIdxByAddr[addr];
          require(monitors[idx].addr != addr, 'existed-monitor');
        }

        monitors.push(MonitorInfo(addr, pubkeyPrefix, pubkeyX,
            intro, stakedAmt, electedTime, 0, new address[](0)));
        monitorIdxByAddr[addr] = monitors.length - 1;
    }

    function updateMonitor(address addr,
                        bytes calldata pubkey,
                        uint stakedAmt,
                        uint electedTime) public {
        require(pubkey.length == 33, 'invalid-pubkey');
        uint pubkeyPrefix = uint(uint8(pubkey[0]));
        bytes32 pubkeyX = bytes32(pubkey[1:]);

        uint idx = monitorIdxByAddr[addr];
        require(monitors[idx].addr == addr, 'no-such-monitor');
        bytes32 intro = monitors[idx].intro;

        monitors[idx] = MonitorInfo(addr, pubkeyPrefix, pubkeyX,
            intro, stakedAmt, electedTime, 0, new address[](0));
    }

}
