//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

interface ICCSystemContract {

    event NewRedeemable(uint256 indexed txid, uint32 indexed vout, address indexed covenantAddr);
    event NewLostAndFound(uint256 indexed txid, uint32 indexed vout, address indexed covenantAddr);
    event Redeem(uint256 indexed txid, uint32 indexed vout, address indexed covenantAddr, uint8 sourceType);
    event ChangeAddr(address indexed oldCovenantAddr, address indexed newCovenantAddr);
    event Convert(uint256 indexed prevTxid, uint32 indexed prevVout, address indexed oldCovenantAddr, uint256 txid, uint32 vout, address newCovenantAddr);
    event Deleted(uint256 indexed txid, uint32 indexed vout, address indexed covenantAddr, uint8 sourceType);

    // monitor only
    function startRescan(uint256 mainFinalizedBlockHeight) external;
    function pause() external;
    function resume() external;

    // anyone
    function handleUTXOs() external;
    function redeem(uint256 txid, uint256 index, address targetAddress) external;

}
