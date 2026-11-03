import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const AMOUNT = ethers.parseUnits("30", 18);
async function fixture() {
  const [owner, buyer, seller, arbiter, arbiter2, outsider] = await ethers.getSigners();
  const token = await ethers.deployContract("PCMToken");
  const escrow = await ethers.deployContract("EscrowBonus", [arbiter.address, arbiter2.address]);
  await token.mint(buyer.address, AMOUNT * 3n);
  await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT * 3n);
  const deadline = (await time.latest()) + 600;
  for (let id = 0; id < 2; id++) {
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "双人仲裁测试");
    await escrow.connect(buyer).deposit(id);
  }
  await escrow.connect(seller).dispute(0);
  return { owner, buyer, seller, arbiter, arbiter2, outsider, token, escrow, deadline };
}

describe("EscrowBonus two-of-two arbitration", () => {
  it("requires two nonzero, different addresses and advertises dual support", async () => {
    const { arbiter, arbiter2, escrow } = await loadFixture(fixture);
    expect(await escrow.supportsDualArbitration()).to.equal(true);
    expect(await escrow.arbiter()).to.equal(arbiter.address);
    expect(await escrow.arbiter2()).to.equal(arbiter2.address);
    for (const addresses of [
      [arbiter.address, arbiter.address],
      [ethers.ZeroAddress, arbiter.address],
      [arbiter.address, ethers.ZeroAddress],
    ]) {
      await expect(ethers.deployContract("EscrowBonus", addresses)).to.be.reverted;
    }
  });
  for (const sellerWins of [false, true])
    for (const reverse of [false, true]) {
      it(`requires both distinct signers, choice=${sellerWins}, reversed order=${reverse}`, async () => {
        const { escrow, arbiter, arbiter2, buyer, seller, token } = await loadFixture(fixture);
        const [first, second] = reverse ? [arbiter2, arbiter] : [arbiter, arbiter2];
        const vote = await escrow.connect(first).resolve(0, sellerWins);
        await expect(vote).to.emit(escrow, "ResolutionVoted").withArgs(0n, first.address, sellerWins);
        await expect(vote).not.to.emit(escrow, "OrderResolved");
        expect(await escrow.lastResolutionVoteBlock(0)).to.equal((await vote.wait())!.blockNumber);
        expect(await escrow.resolutionVotes(0, first.address)).to.equal(sellerWins ? 2n : 1n);
        expect(await escrow.resolutionVotes(0, second.address)).to.equal(0n);
        expect((await escrow.getOrder(0)).status).to.equal(4n);
        expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT * 2n);
        expect(await token.balanceOf(buyer.address)).to.equal(AMOUNT);
        expect(await token.balanceOf(seller.address)).to.equal(0n);
        await expect(escrow.connect(second).resolve(0, sellerWins))
          .to.emit(escrow, "OrderResolved")
          .withArgs(0n, sellerWins);
        expect((await escrow.getOrder(0)).status).to.equal(sellerWins ? 2n : 3n);
        expect(await token.balanceOf(sellerWins ? seller.address : buyer.address)).to.equal(
          sellerWins ? AMOUNT : AMOUNT * 2n,
        );
        expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
        for (const actor of [first, second])
          await expect(escrow.connect(actor).resolve(0, !sellerWins)).to.be.revertedWith("Escrow: wrong status");
      });
    }
  it("a first arbiter cannot obtain a second vote by repeating resolve", async () => {
    const { escrow, arbiter, token } = await loadFixture(fixture);
    await escrow.connect(arbiter).resolve(0, false);
    await expect(escrow.connect(arbiter).resolve(0, false)).to.be.revertedWith("Escrow: same vote already submitted");
    await escrow.connect(arbiter).resolve(0, true);
    await escrow.connect(arbiter).resolve(0, false);
    expect((await escrow.getOrder(0)).status).to.equal(4n);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT * 2n);
  });
  for (const firstChanges of [false, true])
    it(`disagreement retains funds until ${firstChanges ? "first" : "second"} arbiter changes opinion`, async () => {
      const { escrow, arbiter, arbiter2, token } = await loadFixture(fixture);
      await escrow.connect(arbiter).resolve(0, false);
      const mismatch = await escrow.connect(arbiter2).resolve(0, true);
      await expect(mismatch).not.to.emit(escrow, "OrderResolved");
      expect((await escrow.getOrder(0)).status).to.equal(4n);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT * 2n);
      await expect(escrow.connect(firstChanges ? arbiter : arbiter2).resolve(0, firstChanges))
        .to.emit(escrow, "OrderResolved")
        .withArgs(0n, firstChanges);
    });
  it("non-arbiters cannot record votes, and paid orders cannot be resolved", async () => {
    const { escrow, buyer, seller, outsider, owner, arbiter } = await loadFixture(fixture);
    for (const actor of [buyer, seller, outsider, owner]) {
      await expect(escrow.connect(actor).resolve(0, false)).to.be.revertedWith("Escrow: caller is not an arbiter");
      expect(await escrow.resolutionVotes(0, actor.address)).to.equal(0n);
    }
    await expect(escrow.connect(arbiter).resolve(1, false)).to.be.revertedWith("Escrow: wrong status");
    expect(await escrow.lastResolutionVoteBlock(1)).to.equal(0n);
  });
  it("votes are isolated by order and choices cannot be combined across orders", async () => {
    const { escrow, arbiter, arbiter2, seller } = await loadFixture(fixture);
    await escrow.connect(seller).dispute(1);
    await escrow.connect(arbiter).resolve(0, false);
    await escrow.connect(arbiter2).resolve(1, false);
    expect((await escrow.getOrder(0)).status).to.equal(4n);
    expect((await escrow.getOrder(1)).status).to.equal(4n);
    await escrow.connect(arbiter2).resolve(0, false);
    expect((await escrow.getOrder(1)).status).to.equal(4n);
    await escrow.connect(arbiter).resolve(1, true);
    expect((await escrow.getOrder(1)).status).to.equal(4n);
    await escrow.connect(arbiter2).resolve(1, true);
    expect((await escrow.getOrder(1)).status).to.equal(2n);
  });
  it("pending arbitration cannot be bypassed with confirm, refund or shipping", async () => {
    const { escrow, arbiter, buyer, seller, deadline } = await loadFixture(fixture);
    await escrow.connect(arbiter).resolve(0, false);
    await time.increaseTo(deadline + 1);
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: wrong status");
    await expect(escrow.connect(buyer).confirm(0)).to.be.revertedWith("Escrow: order is not paid or shipped");
    await expect(escrow.connect(seller).markShipped(0)).to.be.revertedWith("Escrow: wrong status");
  });
  it("arbiters may also be buyer and seller but still need two different wallets", async () => {
    const { token, buyer, seller, deadline } = await loadFixture(fixture);
    const escrow = await ethers.deployContract("EscrowBonus", [buyer.address, seller.address]);
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "兼任测试");
    await escrow.connect(buyer).deposit(0);
    await escrow.connect(seller).dispute(0);
    await escrow.connect(buyer).resolve(0, false);
    expect((await escrow.getOrder(0)).status).to.equal(4n);
    await escrow.connect(seller).resolve(0, false);
    expect((await escrow.getOrder(0)).status).to.equal(3n);
  });
});
