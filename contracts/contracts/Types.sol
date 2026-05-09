// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum ChallengeType  { Individual, Group, Public }
enum VerifierType   { OnChain, ApiOracle, AiOracle }
enum ChallengeState { JoinOpen, Active, VerifyPending, Settled }
enum ActivityType   { Created, Joined, BetFor, BetAgainst, Settled }