// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal Chainlink Functions Router stub.
// Accepts sendRequest() calls from FunctionsClient and lets tests
// simulate the DON callback via simulateCallback().
contract MockFunctionsRouter {
    uint256 private _nextId = 1;
    bytes32 public lastRequestId;

    // Matches IFunctionsRouter.sendRequest used by FunctionsClient._sendRequest.
    function sendRequest(
        uint64,        // subscriptionId
        bytes memory,  // data (CBOR)
        uint16,        // dataVersion
        uint32,        // callbackGasLimit
        bytes32        // donId
    ) external returns (bytes32 requestId) {
        requestId     = bytes32(_nextId++);
        lastRequestId = requestId;
    }

    // Simulate the Chainlink DON calling handleOracleFulfillment on the client.
    // Since this contract is set as i_router in the verifier, the onlyRouter modifier passes.
    function simulateCallback(
        address client,
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external {
        (bool ok,) = client.call(
            abi.encodeWithSignature(
                "handleOracleFulfillment(bytes32,bytes,bytes)",
                requestId, response, err
            )
        );
        require(ok, "Callback reverted");
    }
}
