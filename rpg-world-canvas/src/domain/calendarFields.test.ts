import { describe, expect, it } from "vitest";
import { defaultCalendarConfig, formatCalendarDate, readCalendarConfig, resolveCalendarDate, type CalendarConfig } from "./calendarFields";

describe("calendarFields", () => {
  it("defaults to a 12x30 calendar starting at day 0", () => {
    const config = defaultCalendarConfig();
    expect(config.months).toHaveLength(12);
    expect(config.months.every((m) => m.days === 30)).toBe(true);
    expect(config.currentDay).toBe(0);
  });

  it("resolveCalendarDate maps day 0 to year 1, first month, day 1", () => {
    const config = defaultCalendarConfig();
    expect(resolveCalendarDate(config, 0)).toEqual({ year: 1, monthIndex: 0, day: 1 });
  });

  it("resolveCalendarDate advances through months and wraps into a new year", () => {
    const config = defaultCalendarConfig(); // 12 months * 30 days = 360-day year
    expect(resolveCalendarDate(config, 30)).toEqual({ year: 1, monthIndex: 1, day: 1 });
    expect(resolveCalendarDate(config, 29)).toEqual({ year: 1, monthIndex: 0, day: 30 });
    expect(resolveCalendarDate(config, 360)).toEqual({ year: 2, monthIndex: 0, day: 1 });
  });

  it("resolveCalendarDate respects custom, unequal month lengths", () => {
    const config: CalendarConfig = { epochLabel: "", months: [{ name: "Gelo", days: 10 }, { name: "Brasa", days: 5 }], currentDay: 0, log: [] };
    expect(resolveCalendarDate(config, 12)).toEqual({ year: 1, monthIndex: 1, day: 3 });
    expect(resolveCalendarDate(config, 15)).toEqual({ year: 2, monthIndex: 0, day: 1 }); // year length 15, wraps
  });

  it("resolveCalendarDate is total (never throws) for a degenerate calendar", () => {
    const config: CalendarConfig = { epochLabel: "", months: [], currentDay: 40, log: [] };
    expect(resolveCalendarDate(config)).toEqual({ year: 1, monthIndex: 0, day: 1 });
  });

  it("formatCalendarDate uses the epoch label when present, else a generic year", () => {
    const withEpoch = { ...defaultCalendarConfig(), epochLabel: "Era de Ferro", currentDay: 0 };
    expect(formatCalendarDate(withEpoch)).toBe("Dia 1 de Mês 1, 1 Era de Ferro");
    const withoutEpoch = defaultCalendarConfig();
    expect(formatCalendarDate(withoutEpoch)).toBe("Dia 1 de Mês 1, Ano 1");
  });

  it("readCalendarConfig falls back to defaults for a missing/malformed bag", () => {
    expect(readCalendarConfig(undefined)).toEqual(defaultCalendarConfig());
    expect(readCalendarConfig({ currentDay: -5, months: "nope" })).toMatchObject({ currentDay: 0 });
  });

  it("readCalendarConfig drops malformed months but keeps valid ones", () => {
    const raw = { months: [{ name: "Ok", days: 20 }, { days: 10 }, "garbage"] };
    expect(readCalendarConfig(raw).months).toEqual([{ name: "Ok", days: 20 }]);
  });
});
