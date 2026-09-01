const CANONICAL_CODE_REFERENCE = /^code:([0-9A-F]{4})$/;
const NUMERIC_HEXADECIMAL_REFERENCE = /^0[xX]([0-9A-Fa-f]{1,4})$/;
const NUMERIC_DECIMAL_REFERENCE = /^[0-9]+$/;

export class CodeReferenceError extends Error {
  public constructor(
    public readonly code: "EMU_MEMORY_REFERENCE" | "EMU_MEMORY_RANGE",
    message: string,
  ) {
    super(message);
    this.name = "CodeReferenceError";
  }
}

export interface ParsedCodeReference {
  address: number;
  canonical: string;
}

export function canonicalCodeReference(address: number): string {
  if (!Number.isSafeInteger(address) || address < 0 || address > 0xffff) {
    throw new CodeReferenceError(
      "EMU_MEMORY_RANGE",
      "CODE address must be an integer from 0 through 65535",
    );
  }
  return `code:${address.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function numericCodeAddress(address: number): string {
  return `0x${canonicalCodeReference(address).slice(5)}`;
}

export function parseOpaqueCodeReference(reference: string): ParsedCodeReference {
  if (typeof reference !== "string") {
    throw new CodeReferenceError(
      "EMU_MEMORY_REFERENCE",
      "memoryReference must be a string",
    );
  }
  const match = CANONICAL_CODE_REFERENCE.exec(reference);
  if (match === null) {
    throw new CodeReferenceError(
      "EMU_MEMORY_REFERENCE",
      "memoryReference must use exact canonical CODE form code:HHHH",
    );
  }
  const address = Number.parseInt(match[1] ?? "", 16);
  return { address, canonical: canonicalCodeReference(address) };
}

export function parseInstructionReference(
  reference: string,
  offset: number | undefined,
): ParsedCodeReference {
  if (typeof reference !== "string") {
    throw new CodeReferenceError(
      "EMU_MEMORY_REFERENCE",
      "instructionReference must be a string",
    );
  }
  let address: number;
  const canonicalMatch = CANONICAL_CODE_REFERENCE.exec(reference);
  const hexadecimalMatch = NUMERIC_HEXADECIMAL_REFERENCE.exec(reference);
  if (canonicalMatch !== null) {
    address = Number.parseInt(canonicalMatch[1] ?? "", 16);
  } else if (hexadecimalMatch !== null) {
    address = Number.parseInt(hexadecimalMatch[1] ?? "", 16);
  } else if (NUMERIC_DECIMAL_REFERENCE.test(reference)) {
    address = Number(reference);
    if (!Number.isSafeInteger(address) || address > 0xffff) {
      throw new CodeReferenceError(
        "EMU_MEMORY_RANGE",
        "instruction reference is outside the 16-bit CODE range",
      );
    }
  } else {
    throw new CodeReferenceError(
      "EMU_MEMORY_REFERENCE",
      "instructionReference must be code:HHHH, 0x/0X with 1-4 hex digits, or unsigned decimal",
    );
  }

  const byteOffset = offset ?? 0;
  if (!Number.isSafeInteger(byteOffset)) {
    throw new CodeReferenceError(
      "EMU_MEMORY_RANGE",
      "instruction breakpoint offset must be a signed integer",
    );
  }
  const adjusted = address + byteOffset;
  if (!Number.isSafeInteger(adjusted) || adjusted < 0 || adjusted > 0xffff) {
    throw new CodeReferenceError(
      "EMU_MEMORY_RANGE",
      "instruction reference plus offset leaves the 16-bit CODE range",
    );
  }
  return { address: adjusted, canonical: canonicalCodeReference(adjusted) };
}
