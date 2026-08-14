import { describe, expect, it } from "vitest";
import { SlotTakenError } from "@maxsport/shared";

describe("slot booking invariants", () => {
  it("SlotTakenError has stable code for API mapping", () => {
    const error = new SlotTakenError();
    expect(error.code).toBe("SLOT_TAKEN");
    expect(error.message).toContain("занят");
  });

  it("simulates race: second booker gets SLOT_TAKEN", () => {
    const slot = { userId: null as string | null, version: 0 };
    const book = (userId: string) => {
      if (slot.userId) throw new SlotTakenError();
      slot.userId = userId;
      slot.version += 1;
      return slot;
    };

    book("user-a");
    expect(() => book("user-b")).toThrow(SlotTakenError);
    expect(slot.userId).toBe("user-a");
    expect(slot.version).toBe(1);
  });
});
