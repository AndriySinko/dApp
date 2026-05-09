// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../Types.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

abstract contract BaseChallenge is AutomationCompatibleInterface {
    // immutable config
    uint256 challengeId;
    address _creator;
    string  title;
    string  criteria;
    uint256 _joinDeadline;
    uint256 _challengeDeadline;
    uint256 _buyIn;
    VerifierType  verifierType;
    address verifierAddress;
    address reputationAddress;
    address treasuryAddress;

    modifier onlyVerifier() {
        require(msg.sender == verifierAddress, "Only verifier can call");
        _;
    }

    modifier onlyRegistered() {
        require(_isRegistered[msg.sender], "Must be a participant");
        _;
    }

    // lifecycle
    ChallengeState _state;

    // participants
    address[] _participants;
    mapping(address => bool)    _isRegistered;
    mapping(address => uint256) _stakes;

    // verdicts
    mapping(address => bool) _verdicts;
    mapping(address => bool) _verdictReceived;
    uint256 _verdictsCompleted;

    // AI oracle
    struct Evidence {
        uint256 day;
        string  ipfsCid;
        bytes32 nonce;
        uint256 timestamp;
        bool    verified;
    }
    mapping(address => Evidence[]) _evidence;

    // API oracle
    mapping(address => string) boundAccount;

    // EVENTS
    event ParticipantRegistered(address indexed participant, uint256 stake, uint256 timestamp);
    event AccountBound(address indexed participant, string serviceAccountId);
    event EvidenceSubmitted(address indexed participant, uint256 day, string ipfsCid, bytes32 nonce, uint256 timestamp);
    event StateChanged(ChallengeState from, ChallengeState to, uint256 timestamp);
    event VerdictReceived(address indexed participant, bool passed, uint256 timestamp);
    event Settled(uint256 winnersCount, uint256 losersCount, uint256 totalDistributed, uint256 fee, uint256 timestamp);
    event ParticipantSettled(address indexed participant, bool won, uint256 payout, int256 pnl);

    // CHAINLINK AUTOMATION
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory) {
        if (_state == ChallengeState.JoinOpen && block.timestamp >= _joinDeadline) {
            upkeepNeeded = true;
        } else if (_state == ChallengeState.Active && block.timestamp >= _challengeDeadline) {
            upkeepNeeded = true;
        } else {
            upkeepNeeded = false;
        }
        return (upkeepNeeded, bytes(""));
    }

    function performUpkeep(bytes calldata) external virtual {
        if (_state == ChallengeState.JoinOpen && block.timestamp >= _joinDeadline) {
            _state = ChallengeState.Active;
            emit StateChanged(ChallengeState.JoinOpen, ChallengeState.Active, block.timestamp);
        } else if (_state == ChallengeState.Active && block.timestamp >= _challengeDeadline) {
            _state = ChallengeState.VerifyPending;
            emit StateChanged(ChallengeState.Active, ChallengeState.VerifyPending, block.timestamp);
            _onVerifyPending();
        } else {
            revert("Upkeep not needed");
        }
    }

    // Child contracts override this to call requestVerification per participant
    function _onVerifyPending() internal virtual;


    // PARTICIPANT ACTIONS
    function bindAccount(string calldata serviceAccountId) external onlyRegistered {
        require(_state == ChallengeState.JoinOpen, "Can only bind during JoinOpen");
        boundAccount[msg.sender] = serviceAccountId;
        emit AccountBound(msg.sender, serviceAccountId);
    }

    function submitEvidence(string calldata ipfsCid, bytes32 nonce) external onlyRegistered {
        require(_state == ChallengeState.Active, "Can only submit evidence during Active");
        uint256 day = (block.timestamp - _joinDeadline) / 1 days;
        _evidence[msg.sender].push(Evidence({
            day: day,
            ipfsCid: ipfsCid,
            nonce: nonce,
            timestamp: block.timestamp,
            verified: false
        }));
        emit EvidenceSubmitted(msg.sender, day, ipfsCid, nonce, block.timestamp);
    }

    function getCurrentDayNonce() external view returns (bytes32) {
        uint256 currentDay = (block.timestamp - _joinDeadline) / 1 days;
        return keccak256(abi.encodePacked(address(this), currentDay));
    }

    function getEvidence(address participant) external view returns (Evidence[] memory) {
        return _evidence[participant];
    }

    function getDaysComplete(address participant) external view returns (uint256) {
        Evidence[] storage evidence = _evidence[participant];
        if (evidence.length == 0) return 0;
        // block.timestamp is non-decreasing so days in the array are non-decreasing;
        // count transitions to get unique day count
        uint256 uniqueDays = 1;
        uint256 lastDay = evidence[0].day;
        for (uint256 i = 1; i < evidence.length; i++) {
            if (evidence[i].day != lastDay) {
                uniqueDays++;
                lastDay = evidence[i].day;
            }
        }
        return uniqueDays;
    }


    // VERIFIER CALLBACK
    function receiveVerdict(address participant, bool passed) external onlyVerifier {
        require(_state == ChallengeState.VerifyPending, "Can only receive verdicts during VerifyPending");
        require(_isRegistered[participant], "Verdict must be for a participant");
        require(!_verdictReceived[participant], "Verdict already received for this participant");

        _verdicts[participant] = passed;
        _verdictReceived[participant] = true;
        _verdictsCompleted++;

        emit VerdictReceived(participant, passed, block.timestamp);
    }


    // SETTLEMENT
    function settle() external virtual;


    // VIEW FUNCTIONS
    function state() external view returns (ChallengeState) {
        return _state;
    }

    function creator() external view returns (address) {
        return _creator;
    }

    function joinDeadline() external view returns (uint256) {
        return _joinDeadline;
    }

    function challengeDeadline() external view returns (uint256) {
        return _challengeDeadline;
    }

    function buyIn() external view returns (uint256) {
        return _buyIn;
    }

    function participants() external view returns (address[] memory) {
        return _participants;
    }

    function isRegistered(address user) external view returns (bool) {
        return _isRegistered[user];
    }

    function stakes(address user) external view returns (uint256) {
        return _stakes[user];
    }

    function verdicts(address user) external view returns (bool) {
        require(_verdictReceived[user], "Verdict not received for this participant");
        return _verdicts[user];
    }

    function verdictReceived(address user) external view returns (bool) {
        return _verdictReceived[user];
    }

    function verdictsExpected() external view returns (uint256) {
        return _participants.length;
    }

    function verdictsCompleted() external view returns (uint256) {
        return _verdictsCompleted;
    }
}
