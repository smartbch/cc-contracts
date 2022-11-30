//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import { ICCOperatorsGov } from "./CCOperatorsGov.sol";
// import "hardhat/console.sol";

interface ICCMonitorsGov {

    function isMonitor(address addr) external view returns (bool);

}

struct MonitorInfo {
    address   addr;           // address
    uint      pubkeyPrefix;   // 0x02 or 0x03
    bytes32   pubkeyX;        // the x coordinate of the pubkey
    bytes32   intro;          // introduction
    uint      stakedAmt;      // staked BCH, monitors have only self-stake
    uint      electedTime;    // 0 means not elected, set by Golang logic after counting votes
    uint      oldElectedTime; // used to get old monitors, set by Golang
    address[] nominatedBy;    // length of nominatedBy is read by Golang
}

contract CCMonitorsGov is ICCMonitorsGov, Ownable {
    using SafeERC20 for IERC20;

    event MonitorApply(address indexed candidate, uint pubkeyPrefix, bytes32 pubkeyX, bytes32 intro, uint stakedAmt);
    event MonitorStake(address indexed candidate, uint amt);
    event MonitorUnstake(address indexed candidate, uint amt);
    event NominatedBy(address indexed candidate, address operator);

    address constant private SEP206_ADDR = address(uint160(0x2711));

    uint constant MIN_STAKED_AMT = 0.1 ether; // TODO: change this

    address immutable OPERATORS_GOV_ADDR;

    uint public lastElectionTime;  // set by Golang
    MonitorInfo[] public monitors; // read&written by Golang
    mapping(address => uint) monitorIdxByAddr;
    uint[] freeSlots;

    constructor(address operatorsGovAddr) {
        OPERATORS_GOV_ADDR = operatorsGovAddr;
    }

    modifier onlyOperator() {
        require(ICCOperatorsGov(OPERATORS_GOV_ADDR).isOperator(msg.sender), 'not-operator');
        _;
    }

    function init(MonitorInfo[] memory monitorList) public onlyOwner {
        require(monitors.length == 0, 'already-initialized');

        for (uint i = 0; i < monitorList.length; i++) {
            MonitorInfo memory monitor = monitorList[i];
            deductBCH(monitor.addr, monitor.stakedAmt);
            addNewMonitor(monitor.addr, uint8(monitor.pubkeyPrefix), monitor.pubkeyX,
                monitor.intro, monitor.stakedAmt, block.timestamp);
        }
    }

    function deductBCH(address monitorAddr, uint amount) internal virtual {
        IERC20(SEP206_ADDR).safeTransferFrom(monitorAddr, address(this), amount);
    }

    // which operators have nominated this monitor?
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

    // apply for the job as a monitor
    function applyMonitor(uint8 pubkeyPrefix,
                          bytes32 pubkeyX,
                          bytes32 intro) public payable {
        // require(monitors.length > 0, 'not-initialized');
        addNewMonitor(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value, 0);
        emit MonitorApply(msg.sender, pubkeyPrefix, pubkeyX, intro, msg.value);
    }

    function addNewMonitor(address monitorAddr,
                           uint8 pubkeyPrefix,
                           bytes32 pubkeyX,
                           bytes32 intro,
                           uint stakedAmt,
                           uint electedTime) private {
        require(pubkeyPrefix == 0x02 || pubkeyPrefix == 0x03, 'invalid-pubkey-prefix');
        require(stakedAmt >= MIN_STAKED_AMT, 'deposit-too-less');

        uint monitorIdx = monitorIdxByAddr[monitorAddr];
        require(monitorIdx == 0, 'monitor-existed'); // zero means not-existed or locate at [0]
        if (monitors.length > 0) { // make sure it does not locate at [0]          
            require(monitors[0].addr != monitorAddr, 'monitor-existed');
        }

        if (freeSlots.length > 0) { // if the 'monitors' list has free slots, i.e., empty slots
            uint freeSlot = freeSlots[freeSlots.length - 1];
            freeSlots.pop();
            monitors[freeSlot] = MonitorInfo(monitorAddr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, 0, new address[](0));
            monitorIdxByAddr[monitorAddr] = freeSlot;
        } else { // no free slot, so we must enlarge the 'monitors' list
            monitors.push(MonitorInfo(monitorAddr, pubkeyPrefix, pubkeyX, intro, stakedAmt, electedTime, 0, new address[](0)));
            monitorIdxByAddr[monitorAddr] = monitors.length - 1;
        }
    }

    // anyone can increase a monitor's self-stake as a donation (but only the monitor can unstake it)
    function addStake(address addr) public payable {
        (MonitorInfo storage monitor,) = loadMonitorInfo(addr);
        require(msg.value > 0, 'deposit-nothing');
        monitor.stakedAmt += msg.value;
        emit MonitorStake(addr, msg.value);
    }

    // a monitor removes part or all of its self-stake
    function removeStake(uint amt) public {
        (MonitorInfo storage monitor, uint monitorIdx) = loadMonitorInfo(msg.sender);
        require(monitor.stakedAmt >= amt, 'withdraw-too-much');

        monitor.stakedAmt -= amt;
        if (monitor.stakedAmt < MIN_STAKED_AMT) {
            // only an inactive monitor can reduce self-stake below the threshold
            require(monitor.electedTime == 0, 'monitor-is-active');
        }
        if (monitor.stakedAmt == 0) { // an inactive monitor has no self-staked coins now, we can delete it
            delete monitors[monitorIdx];
            delete monitorIdxByAddr[msg.sender];
            freeSlots.push(monitorIdx);
        }

        Address.sendValue(payable(msg.sender), amt);
        emit MonitorUnstake(msg.sender, amt);
    }

    // An operator nominates a monitor. A monitor can be elected by the PoW miners only after it gets enough nominations
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


contract CCMonitorsGovForStorageTest is CCMonitorsGov {

    constructor(address operatorsGovAddr) CCMonitorsGov(operatorsGovAddr) {}

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

    function deductBCH(address opAddr, uint amount) internal override {
        // do nothing
    }

}

contract CCMonitorsGovForIntegrationTest is CCMonitorsGov {

    constructor(address operatorsGovAddr) CCMonitorsGov(operatorsGovAddr) {}

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
