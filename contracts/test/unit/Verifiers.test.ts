import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    onChainVerifierFixture,
    apiOracleVerifierFixture,
    aiOracleVerifierFixture,
} from "../helpers/deploy";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ABI = ethers.AbiCoder.defaultAbiCoder();

function encodeParams(criteria: string, serviceAccountId = "") {
    return ABI.encode(["string", "string"], [criteria, serviceAccountId]);
}

function encodeUint256Response(value: bigint) {
    return ABI.encode(["uint256"], [value]);
}

// ── OnChainVerifier ───────────────────────────────────────────────────────────

describe("OnChainVerifier", () => {
    describe("caller guard", () => {
        it("reverts when caller is not the challenge address", async () => {
            const { verifier, challenge, alice } = await loadFixture(onChainVerifierFixture);
            const params = encodeParams("evidence:5");
            // alice calls requestVerification but passes challenge.address as challengeAddress
            // msg.sender (alice) ≠ challengeAddress → revert
            await expect(
                verifier.connect(alice).requestVerification(
                    await challenge.getAddress(), alice.address, params,
                ),
            ).to.be.revertedWith("Caller must be the challenge contract");
        });
    });

    describe("evidence criteria", () => {
        it("passes when daysComplete >= required", async () => {
            const { verifier, challenge, alice } = await loadFixture(onChainVerifierFixture);
            await challenge.setDaysComplete(alice.address, 5);
            const params = encodeParams("evidence:5");
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
        });

        it("fails when daysComplete < required", async () => {
            const { verifier, challenge, alice } = await loadFixture(onChainVerifierFixture);
            await challenge.setDaysComplete(alice.address, 3);
            const params = encodeParams("evidence:5");
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
        });

        it("passes with daysComplete == 0 and required == 0", async () => {
            const { verifier, challenge, alice } = await loadFixture(onChainVerifierFixture);
            const params = encodeParams("evidence:0");
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
        });
    });

    describe("erc20 criteria", () => {
        it("passes when token balance >= minAmt", async () => {
            const { verifier, challenge, erc20, alice } = await loadFixture(onChainVerifierFixture);
            await erc20.setBalance(alice.address, 1_000n);
            const criteria = `erc20:${await erc20.getAddress()}:1000`;
            const params   = encodeParams(criteria);
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
        });

        it("fails when token balance < minAmt", async () => {
            const { verifier, challenge, erc20, alice } = await loadFixture(onChainVerifierFixture);
            await erc20.setBalance(alice.address, 500n);
            const criteria = `erc20:${await erc20.getAddress()}:1000`;
            const params   = encodeParams(criteria);
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
        });

        it("passes when token balance == minAmt (boundary)", async () => {
            const { verifier, challenge, erc20, alice } = await loadFixture(onChainVerifierFixture);
            await erc20.setBalance(alice.address, 1_000n);
            const criteria = `erc20:${await erc20.getAddress()}:1000`;
            const params   = encodeParams(criteria);
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
        });
    });

    describe("nft criteria", () => {
        it("passes when NFT balance >= 1", async () => {
            const { verifier, challenge, erc721, alice } = await loadFixture(onChainVerifierFixture);
            await erc721.setBalance(alice.address, 1n);
            const criteria = `nft:${await erc721.getAddress()}`;
            const params   = encodeParams(criteria);
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
        });

        it("fails when NFT balance == 0", async () => {
            const { verifier, challenge, erc721, alice } = await loadFixture(onChainVerifierFixture);
            const criteria = `nft:${await erc721.getAddress()}`;
            const params   = encodeParams(criteria);
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
        });
    });

    describe("unknown criteria", () => {
        it("delivers false verdict on unknown criteria type instead of reverting", async () => {
            const { verifier, challenge, alice } = await loadFixture(onChainVerifierFixture);
            const params = encodeParams("github:commits:10");
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.emit(verifier, "VerificationFailed");
        });
    });

    describe("events", () => {
        it("emits VerificationRequested and VerdictDelivered", async () => {
            const { verifier, challenge, alice } = await loadFixture(onChainVerifierFixture);
            await challenge.setDaysComplete(alice.address, 5);
            const params        = encodeParams("evidence:5");
            const challengeAddr = await challenge.getAddress();
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            )
                .to.emit(verifier, "VerificationRequested").withArgs(challengeAddr, alice.address)
                .and.emit(verifier, "VerdictDelivered").withArgs(challengeAddr, alice.address, true);
        });
    });
});

// ── ApiOracleVerifier ─────────────────────────────────────────────────────────

describe("ApiOracleVerifier", () => {
    describe("configuration (owner only)", () => {
        it("setJsSource stores the source", async () => {
            const { verifier } = await loadFixture(apiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            expect(await verifier.jsSource()).to.equal("return 1;");
        });

        it("setJsSource reverts on empty string", async () => {
            const { verifier } = await loadFixture(apiOracleVerifierFixture);
            await expect(verifier.setJsSource("")).to.be.revertedWith("Empty source");
        });

        it("setJsSource reverts for non-owner", async () => {
            const { verifier, alice } = await loadFixture(apiOracleVerifierFixture);
            await expect(
                verifier.connect(alice).setJsSource("return 1;"),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });

        it("setSubscriptionId stores the value", async () => {
            const { verifier } = await loadFixture(apiOracleVerifierFixture);
            await verifier.setSubscriptionId(42n);
            expect(await verifier.subscriptionId()).to.equal(42n);
        });

        it("setSubscriptionId reverts for non-owner", async () => {
            const { verifier, alice } = await loadFixture(apiOracleVerifierFixture);
            await expect(
                verifier.connect(alice).setSubscriptionId(42n),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });

        it("setDonId stores the value", async () => {
            const { verifier } = await loadFixture(apiOracleVerifierFixture);
            const id = ethers.encodeBytes32String("test-don");
            await verifier.setDonId(id);
            expect(await verifier.donId()).to.equal(id);
        });

        it("setDonId reverts for non-owner", async () => {
            const { verifier, alice } = await loadFixture(apiOracleVerifierFixture);
            await expect(
                verifier.connect(alice).setDonId(ethers.ZeroHash),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });
    });

    describe("requestVerification", () => {
        it("reverts when caller is not the challenge address", async () => {
            const { verifier, challenge, alice } = await loadFixture(apiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5", "user");
            await expect(
                verifier.connect(alice).requestVerification(
                    await challenge.getAddress(), alice.address, params,
                ),
            ).to.be.revertedWith("Caller must be the challenge contract");
        });

        it("reverts when jsSource is not configured", async () => {
            const { verifier, challenge, alice } = await loadFixture(apiOracleVerifierFixture);
            const params = encodeParams("evidence:5", "user");
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.be.revertedWith("JS source not configured");
        });

        it("reverts when verification is already pending", async () => {
            const { verifier, challenge, alice } = await loadFixture(apiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5", "user");
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.be.revertedWith("Verification already pending");
        });

        it("emits VerificationRequested and records pending state", async () => {
            const { verifier, challenge, router, alice } = await loadFixture(apiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            const params        = encodeParams("evidence:5", "user");
            const challengeAddr = await challenge.getAddress();
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.emit(verifier, "VerificationRequested")
                .withArgs(challengeAddr, alice.address, anyValue);

            // Pending is set: a second call reverts
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.be.revertedWith("Verification already pending");
        });
    });

    describe("fulfillRequest (via simulateCallback)", () => {
        async function setup() {
            const ctx = await loadFixture(apiOracleVerifierFixture);
            await ctx.verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5", "user");
            await ctx.challenge.callRequestVerification(
                await ctx.verifier.getAddress(), ctx.alice.address, params,
            );
            const requestId = await ctx.router.lastRequestId();
            return { ...ctx, requestId, params };
        }

        it("delivers pass verdict when response encodes 1", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await router.simulateCallback(
                await verifier.getAddress(), requestId, encodeUint256Response(1n), "0x",
            );
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
        });

        it("delivers fail verdict when response encodes 0", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await router.simulateCallback(
                await verifier.getAddress(), requestId, encodeUint256Response(0n), "0x",
            );
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
        });

        it("treats malformed response (< 32 bytes) as fail", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await router.simulateCallback(
                await verifier.getAddress(), requestId, "0xdead", "0x",
            );
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
        });

        it("emits VerdictDelivered on success", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            const challengeAddr = await challenge.getAddress();
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), requestId, encodeUint256Response(1n), "0x",
                ),
            ).to.emit(verifier, "VerdictDelivered")
                .withArgs(challengeAddr, alice.address, true, requestId);
        });

        it("emits VerificationErrored and preserves pending on DON error", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            const challengeAddr = await challenge.getAddress();
            const errBytes      = ethers.toUtf8Bytes("DON error");
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), requestId, "0x", errBytes,
                ),
            ).to.emit(verifier, "VerificationErrored")
                .withArgs(challengeAddr, alice.address, requestId, errBytes);

            // Pending preserved: retry should succeed (emits VerificationRetried)
            await expect(
                verifier.retryVerification(challengeAddr, alice.address),
            ).to.emit(verifier, "VerificationRetried");
        });

        it("silently ignores unknown requestId", async () => {
            const { verifier, router } = await setup();
            const unknownId = ethers.ZeroHash;
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), unknownId, encodeUint256Response(1n), "0x",
                ),
            ).to.not.be.reverted;
        });

        it("emits VerificationErrored and preserves pending when challenge.receiveVerdict reverts", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await challenge.setRevertOnVerdict(true);
            const challengeAddr = await challenge.getAddress();
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), requestId, encodeUint256Response(1n), "0x",
                ),
            ).to.emit(verifier, "VerificationErrored")
                .withArgs(challengeAddr, alice.address, requestId, "0x");

            // Verdict was NOT delivered despite passing response
            expect(await challenge.verdictReceived(alice.address)).to.be.false;

            // Pending preserved: retry is possible after re-enabling receiveVerdict
            await challenge.setRevertOnVerdict(false);
            await expect(
                verifier.retryVerification(challengeAddr, alice.address),
            ).to.emit(verifier, "VerificationRetried");
        });
    });

    describe("retryVerification", () => {
        async function setupAfterError() {
            const ctx = await loadFixture(apiOracleVerifierFixture);
            await ctx.verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5", "user");
            await ctx.challenge.callRequestVerification(
                await ctx.verifier.getAddress(), ctx.alice.address, params,
            );
            const requestId = await ctx.router.lastRequestId();
            // Simulate DON error so pending is preserved but activeRequestId is cleared
            await ctx.router.simulateCallback(
                await ctx.verifier.getAddress(), requestId, "0x", ethers.toUtf8Bytes("err"),
            );
            return { ...ctx, requestId };
        }

        it("reverts for non-owner", async () => {
            const { verifier, challenge, alice } = await setupAfterError();
            await expect(
                verifier.connect(alice).retryVerification(
                    await challenge.getAddress(), alice.address,
                ),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });

        it("reverts when there is no pending verification", async () => {
            const { verifier, challenge, bob } = await setupAfterError();
            await expect(
                verifier.retryVerification(await challenge.getAddress(), bob.address),
            ).to.be.revertedWith("No pending verification");
        });

        it("reverts while a request is still in flight", async () => {
            const ctx = await loadFixture(apiOracleVerifierFixture);
            await ctx.verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5", "user");
            await ctx.challenge.callRequestVerification(
                await ctx.verifier.getAddress(), ctx.alice.address, params,
            );
            // Not simulated yet → activeRequestId is set → retry reverts
            await expect(
                ctx.verifier.retryVerification(
                    await ctx.challenge.getAddress(), ctx.alice.address,
                ),
            ).to.be.revertedWith("Request still in flight");
        });

        it("emits VerificationRetried with a new requestId", async () => {
            const { verifier, challenge, router, alice, requestId: firstId } = await setupAfterError();
            const challengeAddr = await challenge.getAddress();
            const tx = await verifier.retryVerification(challengeAddr, alice.address);
            const receipt = await tx.wait();
            const newId = await router.lastRequestId();
            expect(newId).to.not.equal(firstId);
            expect(receipt).to.not.be.null;
        });
    });
});

// ── AiOracleVerifier ──────────────────────────────────────────────────────────

describe("AiOracleVerifier", () => {
    describe("configuration (owner only)", () => {
        it("setJsSource stores the source", async () => {
            const { verifier } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            expect(await verifier.jsSource()).to.equal("return 1;");
        });

        it("setJsSource reverts on empty string", async () => {
            const { verifier } = await loadFixture(aiOracleVerifierFixture);
            await expect(verifier.setJsSource("")).to.be.revertedWith("Empty source");
        });

        it("setJsSource reverts for non-owner", async () => {
            const { verifier, alice } = await loadFixture(aiOracleVerifierFixture);
            await expect(
                verifier.connect(alice).setJsSource("return 1;"),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });

        it("setSubscriptionId stores the value", async () => {
            const { verifier } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setSubscriptionId(99n);
            expect(await verifier.subscriptionId()).to.equal(99n);
        });

        it("setDonId stores the value", async () => {
            const { verifier } = await loadFixture(aiOracleVerifierFixture);
            const id = ethers.encodeBytes32String("ai-don");
            await verifier.setDonId(id);
            expect(await verifier.donId()).to.equal(id);
        });

        it("setSecretsReference stores slotId and version", async () => {
            const { verifier } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setSecretsReference(2, 5n);
            expect(await verifier.secretsSlotId()).to.equal(2);
            expect(await verifier.secretsVersion()).to.equal(5n);
        });

        it("setSecretsReference reverts for non-owner", async () => {
            const { verifier, alice } = await loadFixture(aiOracleVerifierFixture);
            await expect(
                verifier.connect(alice).setSecretsReference(0, 1n),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });
    });

    describe("requestVerification", () => {
        it("reverts when caller is not the challenge address", async () => {
            const { verifier, challenge, alice } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            await expect(
                verifier.connect(alice).requestVerification(
                    await challenge.getAddress(), alice.address, params,
                ),
            ).to.be.revertedWith("Caller must be the challenge contract");
        });

        it("reverts when jsSource is not configured", async () => {
            const { verifier, challenge, alice } = await loadFixture(aiOracleVerifierFixture);
            const params = encodeParams("evidence:5");
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.be.revertedWith("JS source not configured");
        });

        it("reverts when secrets are not configured", async () => {
            const { router, challenge, alice, owner } = await loadFixture(aiOracleVerifierFixture);
            // Deploy a fresh verifier with no secrets set
            const { AiOracleVerifier__factory } = await import("../../typechain-types");
            const fresh = await new AiOracleVerifier__factory(owner).deploy(
                await router.getAddress(), owner.address, 1n, ethers.ZeroHash,
            );
            await fresh.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            await expect(
                challenge.callRequestVerification(await fresh.getAddress(), alice.address, params),
            ).to.be.revertedWith("Secrets not configured");
        });

        it("reverts when verification is already pending", async () => {
            const { verifier, challenge, alice } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            await challenge.callRequestVerification(await verifier.getAddress(), alice.address, params);
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.be.revertedWith("Verification already pending");
        });

        it("dispatches request with no evidence (empty CIDs/nonces)", async () => {
            const { verifier, challenge, router, alice } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            // No evidence added to challenge — should still succeed (empty string args)
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.emit(verifier, "VerificationRequested");
            expect(await router.lastRequestId()).to.not.equal(ethers.ZeroHash);
        });

        it("dispatches request after evidence is added", async () => {
            const { verifier, challenge, router, alice } = await loadFixture(aiOracleVerifierFixture);
            await verifier.setJsSource("return 1;");
            await challenge.addEvidence(alice.address, 1, "Qmabc", ethers.ZeroHash);
            await challenge.addEvidence(alice.address, 2, "Qmdef", ethers.ZeroHash);
            const params = encodeParams("evidence:5");
            await expect(
                challenge.callRequestVerification(await verifier.getAddress(), alice.address, params),
            ).to.emit(verifier, "VerificationRequested");
            expect(await router.lastRequestId()).to.not.equal(ethers.ZeroHash);
        });
    });

    describe("fulfillRequest (via simulateCallback)", () => {
        async function setup() {
            const ctx = await loadFixture(aiOracleVerifierFixture);
            await ctx.verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            await ctx.challenge.addEvidence(ctx.alice.address, 1, "Qmabc", ethers.ZeroHash);
            await ctx.challenge.callRequestVerification(
                await ctx.verifier.getAddress(), ctx.alice.address, params,
            );
            const requestId = await ctx.router.lastRequestId();
            return { ...ctx, requestId };
        }

        it("delivers pass verdict when response encodes 1", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await router.simulateCallback(
                await verifier.getAddress(), requestId, encodeUint256Response(1n), "0x",
            );
            expect(await challenge.lastVerdict(alice.address)).to.be.true;
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
        });

        it("delivers fail verdict when response encodes 0", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await router.simulateCallback(
                await verifier.getAddress(), requestId, encodeUint256Response(0n), "0x",
            );
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
            expect(await challenge.verdictReceived(alice.address)).to.be.true;
        });

        it("treats malformed response (< 32 bytes) as fail", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await router.simulateCallback(
                await verifier.getAddress(), requestId, "0xdead", "0x",
            );
            expect(await challenge.lastVerdict(alice.address)).to.be.false;
        });

        it("emits VerificationErrored and preserves pending on DON error", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            const challengeAddr = await challenge.getAddress();
            const errBytes      = ethers.toUtf8Bytes("DON error");
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), requestId, "0x", errBytes,
                ),
            ).to.emit(verifier, "VerificationErrored")
                .withArgs(challengeAddr, alice.address, requestId, errBytes);

            // Retry must succeed
            await expect(
                verifier.retryVerification(challengeAddr, alice.address),
            ).to.emit(verifier, "VerificationRetried");
        });

        it("silently ignores unknown requestId", async () => {
            const { verifier, router } = await setup();
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), ethers.ZeroHash, encodeUint256Response(1n), "0x",
                ),
            ).to.not.be.reverted;
        });

        it("emits VerificationErrored when challenge.receiveVerdict reverts", async () => {
            const { verifier, challenge, router, alice, requestId } = await setup();
            await challenge.setRevertOnVerdict(true);
            const challengeAddr = await challenge.getAddress();
            await expect(
                router.simulateCallback(
                    await verifier.getAddress(), requestId, encodeUint256Response(1n), "0x",
                ),
            ).to.emit(verifier, "VerificationErrored")
                .withArgs(challengeAddr, alice.address, requestId, "0x");
            expect(await challenge.verdictReceived(alice.address)).to.be.false;
        });
    });

    describe("retryVerification", () => {
        async function setupAfterError() {
            const ctx = await loadFixture(aiOracleVerifierFixture);
            await ctx.verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            await ctx.challenge.callRequestVerification(
                await ctx.verifier.getAddress(), ctx.alice.address, params,
            );
            const requestId = await ctx.router.lastRequestId();
            await ctx.router.simulateCallback(
                await ctx.verifier.getAddress(), requestId, "0x", ethers.toUtf8Bytes("err"),
            );
            return { ...ctx, requestId };
        }

        it("reverts for non-owner", async () => {
            const { verifier, challenge, alice } = await setupAfterError();
            await expect(
                verifier.connect(alice).retryVerification(
                    await challenge.getAddress(), alice.address,
                ),
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });

        it("reverts when there is no pending verification", async () => {
            const { verifier, challenge, bob } = await setupAfterError();
            await expect(
                verifier.retryVerification(await challenge.getAddress(), bob.address),
            ).to.be.revertedWith("No pending verification");
        });

        it("reverts while a request is still in flight", async () => {
            const ctx = await loadFixture(aiOracleVerifierFixture);
            await ctx.verifier.setJsSource("return 1;");
            const params = encodeParams("evidence:5");
            await ctx.challenge.callRequestVerification(
                await ctx.verifier.getAddress(), ctx.alice.address, params,
            );
            await expect(
                ctx.verifier.retryVerification(
                    await ctx.challenge.getAddress(), ctx.alice.address,
                ),
            ).to.be.revertedWith("Request still in flight");
        });

        it("succeeds after DON error and emits VerificationRetried with new requestId", async () => {
            const { verifier, challenge, router, alice, requestId: firstId } = await setupAfterError();
            const challengeAddr = await challenge.getAddress();
            await verifier.retryVerification(challengeAddr, alice.address);
            const newId = await router.lastRequestId();
            expect(newId).to.not.equal(firstId);
        });

        it("emits VerificationRetried event", async () => {
            const { verifier, challenge, alice } = await setupAfterError();
            const challengeAddr = await challenge.getAddress();
            await expect(
                verifier.retryVerification(challengeAddr, alice.address),
            ).to.emit(verifier, "VerificationRetried");
        });
    });
});
