import deployedContracts from "~~/contracts/deployedContracts";
import { selectedEscrow } from "~~/contracts/selectedEscrow";

export const CHAIN_ID = 60600;
export const escrowContract = selectedEscrow;
export const tokenContract = deployedContracts[CHAIN_ID].PCMToken;
export const explorerUrl = "https://scan-testnet.potos.hk";
