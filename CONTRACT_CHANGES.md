# Pending Contract Changes

Changes to apply on next redeploy.

---

## 1. Make `boundAccount` mapping public in `BaseChallenge.sol`

**File:** `contracts/contracts/challenges/BaseChallenge.sol` line 60

**Change:**
```solidity
// before
mapping(address => string) boundAccount;

// after
mapping(address => string) public boundAccount;
```

**Why:** Without `public`, no auto-generated getter exists and the frontend cannot read a user's bound account ID from the contract. After refresh the bound account disappears from the UI because every read returns `undefined`.
