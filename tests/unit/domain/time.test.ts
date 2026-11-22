import { describe, expect, it } from "vitest";
import { addDays, hoursBetween, localTime, weekdayOf } from "@/domain/time/clock";
import { formatHour, formatTime, formatWindow, hindiDayPart, parseHhMm } from "@/domain/time/format";
import { istClock } from "../../helpers/air";

describe("injected clock", () => {
  it("reads local parts in the clock's zone, not the machine's", () => {
    expect(localTime(istClock("2024-11-18T06:10"))).toEqual({ date: "2024-11-18", hour: 6, minute: 10, month: 11, day: 18 });
    expect(localTime({ now: new Date("2024-11-18T20:00:00Z"), timeZone: "Asia/Kolkata" })).toMatchObject({
      date: "2024-11-19",
      hour: 1,
      minute: 30,
    });
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2024-11-30", 1)).toBe("2024-12-01");
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("names weekdays and measures hours", () => {
    expect(weekdayOf("2024-11-18")).toBe("mon");
    expect(weekdayOf("2025-01-31")).toBe("fri");
    expect(hoursBetween(new Date("2024-01-01T00:00:00Z"), new Date("2024-01-01T03:30:00Z"))).toBe(3.5);
  });
});

describe("time formats", () => {
  it.each([
    [0, "12 am", "रात 12 बजे"],
    [6, "6 am", "सुबह 6 बजे"],
    [12, "12 pm", "दोपहर 12 बजे"],
    [15, "3 pm", "दोपहर 3 बजे"],
    [17, "5 pm", "शाम 5 बजे"],
    [21, "9 pm", "रात 9 बजे"],
  ])("hour %i", (hour, en, hi) => {
    expect(formatHour(hour, "en")).toBe(en);
    expect(formatHour(hour, "hi")).toBe(hi);
  });

  it("formats minutes", () => {
    expect(formatTime(6, 30, "en")).toBe("6:30 am");
    expect(formatTime(6, 30, "hi")).toBe("सुबह 6:30 बजे");
  });

  it("formats windows within and across day parts", () => {
    expect(formatWindow(14, 16, "en")).toBe("2–4 pm");
    expect(formatWindow(11, 13, "en")).toBe("11 am–1 pm");
    expect(formatWindow(14, 16, "hi")).toBe("दोपहर 2–4 बजे");
    expect(formatWindow(11, 13, "hi")).toBe("सुबह 11 बजे–दोपहर 1 बजे");
    expect(formatWindow(22, 24, "en")).toBe("10 pm–12 am");
  });

  it("names Hindi day parts and parses HH:MM", () => {
    expect([3, 4, 11, 12, 15, 16, 19, 20].map(hindiDayPart)).toEqual(["रात", "सुबह", "सुबह", "दोपहर", "दोपहर", "शाम", "शाम", "रात"]);
    expect(parseHhMm("06:30")).toEqual({ hour: 6, minute: 30 });
  });
});
