// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GroupChallenge.sol";

contract PublicChallenge is GroupChallenge {
    uint256 _prizePool;

    constructor(
        uint256 id,
        address creatorAddr,
        string memory titleStr,
        string memory criteriaStr,
        uint256 joinDl,
        uint256 challengeDl,
        uint256 buyInAmt,
        VerifierType vType,
        address vAddress,
        address repAddress,
        address treasAddress
    ) payable GroupChallenge(
        id, creatorAddr, titleStr, criteriaStr,
        joinDl, challengeDl, buyInAmt,
        vType, vAddress, repAddress, treasAddress
    ) {
        require(msg.value > 0, "Prize pool required");
        _prizePool = msg.value;
    }

    function settle() public virtual override {
        require(_state == ChallengeState.VerifyPending, "Not ready to settle");
        require(_verdictsCompleted == _participants.length, "Not all verdicts received");

        _state = ChallengeState.Settled;

        uint256 winnersCount;
        uint256 losersCount;
        uint256 totalWinnerStake;
        uint256 loserPot;

        for (uint256 i = 0; i < _participants.length; i++) {
            address p = _participants[i];
            if (_verdicts[p]) {
                winnersCount++;
                totalWinnerStake += _stakes[p];
            } else {
                losersCount++;
                loserPot += _stakes[p];
            }
        }

        // All lose → stakes + prize pool → Treasury
        if (winnersCount == 0) {
            uint256 totalPool = loserPot + _prizePool;
            if (totalPool > 0) {
                ITreasury(treasuryAddress).depositFee{value: totalPool}();
            }
            for (uint256 i = 0; i < _participants.length; i++) {
                address p = _participants[i];
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
                IReputation(reputationAddress).updateRep(p, -50, address(this));
            }
            emit Settled(0, losersCount, 0, totalPool, block.timestamp);
            return;
        }

        // All win → everyone gets stake back + flat prize bonus, no fee
        if (losersCount == 0) {
            uint256 prizeBonus = _prizePool / winnersCount;
            uint256 totalDistributed;
            for (uint256 i = 0; i < _participants.length; i++) {
                address p = _participants[i];
                uint256 payout = _stakes[p] + prizeBonus;
                pendingWithdrawals[p] += payout;
                totalDistributed      += payout;
                emit ParticipantSettled(p, true, payout, int256(prizeBonus));
                IReputation(reputationAddress).updateRep(p, 100, address(this));
            }
            uint256 dust = _prizePool - prizeBonus * winnersCount;
            if (dust > 0) {
                ITreasury(treasuryAddress).depositFee{value: dust}();
            }
            emit Settled(winnersCount, 0, totalDistributed, dust, block.timestamp);
            return;
        }

        // Normal: winners split loser pot proportionally (no fee) + flat prize bonus
        uint256 prizeBonus    = _prizePool / winnersCount;
        uint256 totalDistributed;
        for (uint256 i = 0; i < _participants.length; i++) {
            address p = _participants[i];
            if (_verdicts[p]) {
                uint256 groupWinnings = (_stakes[p] * loserPot) / totalWinnerStake;
                uint256 payout        = _stakes[p] + groupWinnings + prizeBonus;
                pendingWithdrawals[p] += payout;
                totalDistributed      += payout;
                emit ParticipantSettled(p, true, payout, int256(groupWinnings + prizeBonus));
                IReputation(reputationAddress).updateRep(p, 100, address(this));
            } else {
                emit ParticipantSettled(p, false, 0, -int256(_stakes[p]));
                IReputation(reputationAddress).updateRep(p, -50, address(this));
            }
        }

        // Dust from integer division on both loserPot and prizePool splits → Treasury
        uint256 dust = (totalWinnerStake + loserPot + _prizePool) - totalDistributed;
        if (dust > 0) {
            ITreasury(treasuryAddress).depositFee{value: dust}();
        }

        emit Settled(winnersCount, losersCount, totalDistributed, dust, block.timestamp);
    }

    // If challenge deadline passes with no participants, prize pool would be locked
    // forever because _onVerifyPending reverts. This allows governance to reclaim it.
    function reclaimPrizePool() external {
        require(msg.sender == _creator,             "Only creator");
        require(_state == ChallengeState.Active,    "Not in Active state");
        require(_participants.length == 0,          "Participants exist");
        require(block.timestamp > _challengeDeadline, "Challenge not over");

        _state = ChallengeState.Settled;
        uint256 amount = _prizePool;
        _prizePool = 0;
        ITreasury(treasuryAddress).depositFee{value: amount}();
    }

    function prizePool() external view returns (uint256) { return _prizePool; }
}
