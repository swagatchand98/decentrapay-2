// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice College demo: test ETH enters this contract; a local bridge simulates cash.
/// @dev Fingerprints and physical dispensing are verified off-chain, not by this contract.
contract DemoATM {
    mapping(bytes32 => bool) public usedRequests;
    event CashRequested(bytes32 indexed requestId, address indexed customer, uint256 paymentWei, uint256 cashRupees);
    error InvalidAmount();
    error InvalidRequest();

    function requestCash(bytes32 requestId) external payable {
        if (requestId == bytes32(0) || usedRequests[requestId]) revert InvalidRequest();
        uint256 rupees;
        if (msg.value == 0.001 ether) rupees = 100;
        else if (msg.value == 0.002 ether) rupees = 200;
        else if (msg.value == 0.005 ether) rupees = 500;
        else revert InvalidAmount();
        usedRequests[requestId] = true;
        emit CashRequested(requestId, msg.sender, msg.value, rupees);
    }
}
