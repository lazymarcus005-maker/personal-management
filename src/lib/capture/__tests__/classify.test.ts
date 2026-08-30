import { describe, it, expect } from "vitest";
import { classifyCapture } from "@/lib/capture/classify";

const NOW = new Date(2026, 7, 30, 10, 0, 0); // 2026-08-30 10:00 local

describe("classifyCapture — handoff examples", () => {
  it("classifies a Thai expense with amount and hobby area hint", () => {
    const result = classifyCapture(
      "ซื้อคีย์บอร์ด 2,590 บาท สำหรับ hobby keyboard",
      NOW
    );
    expect(result.type).toBe("EXPENSE");
    expect(result.amount).toBe(2590);
    expect(result.currency).toBe("THB");
    expect(result.areaHint).toBe("Hobby");
    expect(result.suggestedTags).toContain("hobby");
  });

  it("classifies a tomorrow reminder as a todo with a due date", () => {
    const result = classifyCapture("พรุ่งนี้โทรหาคุณ A", NOW);
    expect(result.type).toBe("TODO");
    expect(result.dueDate).not.toBeNull();
    const due = new Date(result.dueDate!);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(7);
    expect(due.getDate()).toBe(31);
  });

  it("classifies a wish/idea as an idea", () => {
    const result = classifyCapture("อยากทำระบบ Home Lab บน Mac mini", NOW);
    expect(result.type).toBe("IDEA");
  });

  it("classifies a reflective entry as a journal entry", () => {
    const result = classifyCapture(
      "วันนี้ทำงานได้ดี แต่รู้สึกเหนื่อยช่วงบ่าย",
      NOW
    );
    expect(result.type).toBe("JOURNAL");
  });
});

describe("classifyCapture — additional rules", () => {
  it("detects income verbs with an amount", () => {
    const result = classifyCapture("ได้เงินเดือน 35000 บาท", NOW);
    expect(result.type).toBe("INCOME");
    expect(result.amount).toBe(35000);
  });

  it("detects prefixed currency symbols", () => {
    const result = classifyCapture("paid ฿120 for coffee", NOW);
    expect(result.type).toBe("EXPENSE");
    expect(result.amount).toBe(120);
    expect(result.currency).toBe("THB");
  });

  it("does not classify numbers without a currency marker as expenses", () => {
    const result = classifyCapture("read chapter 5 of the book", NOW);
    expect(result.amount).toBeNull();
  });

  it("falls back to a note for plain text", () => {
    const result = classifyCapture("server rack layout ideas for the closet", NOW);
    expect(result.type).toBe("NOTE");
  });

  it("suggests a health area hint", () => {
    const result = classifyCapture("วิ่ง 5 กม ที่สวน", NOW);
    expect(result.areaHint).toBe("Health");
  });

  it("extracts an explicit hashtag as a tag", () => {
    const result = classifyCapture("bought new lens #photography", NOW);
    expect(result.suggestedTags).toContain("photography");
  });

  it("keeps titles readable after stripping the amount", () => {
    const result = classifyCapture("ซื้อคีย์บอร์ด 2,590 บาท", NOW);
    expect(result.title).not.toContain("2,590");
    expect(result.title).toContain("คีย์บอร์ด");
  });

  it("never produces a due date for non-todo types", () => {
    const result = classifyCapture("พรุ่งนี้ดูเรื่องราคา รู้สึกวันนี้เหนื่อย", NOW);
    if (result.type !== "TODO") {
      expect(result.dueDate).toBeNull();
    }
  });
});
