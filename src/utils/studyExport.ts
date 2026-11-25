import ExcelJS from "exceljs";
import { addChart } from "chartsheet";
import type { StudySession } from "../types/study";

const DAY_MS = 24 * 60 * 60 * 1000;

type DailyRow = {
  date: string;
  seconds: number;
  sessions: number;
  subjects: Record<string, number>;
};

type WeeklyRow = {
  week: string;
  totalSeconds: number;
  totalHours: number;
  averagePerCalendarDay: number;
  averagePerActiveDay: number;
  activeDays: number;
  sessions: number;
  daysIncluded: number;
  goalDays: number;
};

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayStart(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function nextDayStart(key: string): number {
  const date = dayStart(key);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

function addDaysKey(key: string, days: number): string {
  const date = dayStart(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function mondayKey(timestamp: number): string {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}

function hours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

function minutes(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100;
}

function average(total: number, count: number): number {
  return count > 0 ? total / count : 0;
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Prevent spreadsheet formula injection in exported CSV files.
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void {
  const content = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  downloadBlob(
    new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

function emptyDailyRow(date: string): DailyRow {
  return { date, seconds: 0, sessions: 0, subjects: {} };
}

/** Split session duration across local calendar days, including DST boundaries. */
function buildDailyData(sessions: StudySession[]): DailyRow[] {
  const map = new Map<string, DailyRow>();

  for (const session of sessions) {
    if (
      !Number.isFinite(session.startedAt) ||
      !Number.isFinite(session.durationSeconds)
    )
      continue;

    const start = session.startedAt;
    const durationEnd = start + Math.max(0, session.durationSeconds) * 1000;
    const recordedEnd = Number.isFinite(session.endedAt)
      ? session.endedAt
      : durationEnd;
    const end = Math.max(start, durationEnd, recordedEnd);

    // A zero-duration session still counts as a session on its start date.
    const startKey = dateKey(new Date(start));
    const startRow = map.get(startKey) ?? emptyDailyRow(startKey);
    startRow.sessions += 1;
    map.set(startKey, startRow);

    let cursor = start;
    while (cursor < end) {
      const key = dateKey(new Date(cursor));
      const segmentEnd = Math.min(end, nextDayStart(key));
      const segmentSeconds = Math.max(
        0,
        Math.round((segmentEnd - cursor) / 1000),
      );
      const row = map.get(key) ?? emptyDailyRow(key);

      row.seconds += segmentSeconds;
      row.subjects[session.subjectName] =
        (row.subjects[session.subjectName] ?? 0) + segmentSeconds;

      map.set(key, row);
      cursor = segmentEnd;
    }
  }

  if (map.size === 0) return [];

  const first = [...map.keys()].sort()[0];
  const today = dateKey(new Date());
  const sortedKeys = [...map.keys()].sort();
  const latestRecorded = sortedKeys[sortedKeys.length - 1] ?? today;
  const last = latestRecorded > today ? latestRecorded : today;
  const result: DailyRow[] = [];

  for (let key = first; key <= last; key = addDaysKey(key, 1)) {
    result.push(map.get(key) ?? emptyDailyRow(key));
  }

  return result;
}

function buildWeeklyData(daily: DailyRow[]): WeeklyRow[] {
  const map = new Map<string, DailyRow[]>();
  for (const day of daily) {
    const week = mondayKey(dayStart(day.date).getTime());
    const group = map.get(week) ?? [];
    group.push(day);
    map.set(week, group);
  }

  const currentWeek = mondayKey(Date.now());
  const today = dateKey(new Date());

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, days]) => {
      const totalSeconds = days.reduce((sum, day) => sum + day.seconds, 0);
      const activeDays = days.filter((day) => day.seconds > 0).length;
      const sessions = days.reduce((sum, day) => sum + day.sessions, 0);
      const daysIncluded = days.length;
      // A current week is compared against the goal for elapsed days only;
      // completed weeks are compared against all seven days.
      const goalDays =
        week === currentWeek
          ? Math.max(
              1,
              Math.min(
                7,
                Math.round(
                  (dayStart(today).getTime() - dayStart(week).getTime()) /
                    DAY_MS,
                ) + 1,
              ),
            )
          : 7;

      return {
        week,
        totalSeconds,
        totalHours: hours(totalSeconds),
        averagePerCalendarDay: hours(totalSeconds / 7),
        averagePerActiveDay: hours(average(totalSeconds, activeDays)),
        activeDays,
        sessions,
        daysIncluded,
        goalDays,
      };
    });
}

function subjectTotals(daily: DailyRow[]) {
  const totals = new Map<string, number>();
  for (const day of daily) {
    for (const [subject, seconds] of Object.entries(day.subjects)) {
      totals.set(subject, (totals.get(subject) ?? 0) + seconds);
    }
  }

  return [...totals.entries()]
    .map(([subject, seconds]) => ({
      subject,
      seconds,
      totalHours: hours(seconds),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

function styleHeader(row: ExcelJS.Row): void {
  row.height = 25;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF244A83" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
}

function styleSheet(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.getRow(1).height = 25;
  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.width ?? 14, 14), 34);
  });
}

/** ExcelJS addTable writes the header and data rows itself. Do not addRow first. */
function addTable(
  sheet: ExcelJS.Worksheet,
  name: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  sheet.addTable({
    name,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: headers.map((header) => ({ name: header })),
    rows,
  });
  styleHeader(sheet.getRow(1));
  styleSheet(sheet);
}

function formatHoursColumn(sheet: ExcelJS.Worksheet, column: number): void {
  sheet.getColumn(column).numFmt = "0.00";
}

function safePercent(numerator: number, denominator: number): number {
  return denominator > 0
    ? Math.round((numerator / denominator) * 10000) / 100
    : 0;
}

function makeRawSessionRows(sessions: StudySession[]): (string | number)[][] {
  return sessions.map((session) => [
    session.id,
    dateKey(new Date(session.startedAt)),
    session.subjectName,
    session.topicName ?? "",
    session.tag ?? "",
    session.mode,
    new Date(session.startedAt).toISOString(),
    new Date(session.endedAt).toISOString(),
    new Date(session.startedAt).toLocaleTimeString(),
    new Date(session.endedAt).toLocaleTimeString(),
    session.durationSeconds,
    minutes(session.durationSeconds),
    hours(session.durationSeconds),
  ]);
}

export async function exportRawSessionsCSV(
  sessions: StudySession[],
): Promise<void> {
  const headers = [
    "Session ID",
    "Date",
    "Subject",
    "Topic",
    "Tag",
    "Mode",
    "Start Timestamp",
    "End Timestamp",
    "Start Time",
    "End Time",
    "Duration Seconds",
    "Duration Minutes",
    "Duration Hours",
  ];
  downloadCSV(
    headers,
    makeRawSessionRows(sessions),
    `studyos-all-sessions-${dateKey(new Date())}.csv`,
  );
}

export async function exportDailyCSV(
  sessions: StudySession[],
  dailyGoalMinutes: number,
): Promise<void> {
  const daily = buildDailyData(sessions);
  const headers = [
    "Date",
    "Total Seconds",
    "Total Minutes",
    "Total Hours",
    "Sessions Started",
    "Active Study Day",
    "Daily Goal Minutes",
    "Goal Achievement %",
    "Subjects Studied",
  ];
  const rows = daily.map((day) => [
    day.date,
    day.seconds,
    minutes(day.seconds),
    hours(day.seconds),
    day.sessions,
    day.seconds > 0 ? "Yes" : "No",
    dailyGoalMinutes,
    safePercent(day.seconds, dailyGoalMinutes * 60),
    Object.keys(day.subjects).join("; "),
  ]);
  downloadCSV(
    headers,
    rows,
    `studyos-daily-analysis-${dateKey(new Date())}.csv`,
  );
}

export async function exportWeeklyCSV(
  sessions: StudySession[],
  dailyGoalMinutes: number,
): Promise<void> {
  const weekly = buildWeeklyData(buildDailyData(sessions));
  const headers = [
    "Week Starting Monday",
    "Total Seconds",
    "Total Hours",
    "Average Per Calendar Day (Hours)",
    "Average Per Active Day (Hours)",
    "Active Days",
    "Sessions",
    "Weekly Goal Hours",
    "Goal Achievement %",
  ];
  const rows = weekly.map((week) => {
    const goalSeconds = week.goalDays * dailyGoalMinutes * 60;
    return [
      week.week,
      week.totalSeconds,
      week.totalHours,
      week.averagePerCalendarDay,
      week.averagePerActiveDay,
      week.activeDays,
      week.sessions,
      hours(goalSeconds),
      safePercent(week.totalSeconds, goalSeconds),
    ];
  });
  downloadCSV(
    headers,
    rows,
    `studyos-weekly-analysis-${dateKey(new Date())}.csv`,
  );
}

export async function exportStudyAnalyticsExcel(
  sessions: StudySession[],
  dailyGoalMinutes: number,
): Promise<void> {
  const daily = buildDailyData(sessions);
  const weekly = buildWeeklyData(daily);
  const subjects = subjectTotals(daily);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StudyOS";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Daily analysis
  const dailySheet = workbook.addWorksheet("Daily Analysis");
  addTable(
    dailySheet,
    "DailyStudyTable",
    [
      "Date",
      "Total Seconds",
      "Total Minutes",
      "Total Hours",
      "Sessions Started",
      "Active Day",
      "Daily Goal Hours",
      "Goal Achievement %",
      "Subjects Studied",
    ],
    daily.map((day) => [
      day.date,
      day.seconds,
      minutes(day.seconds),
      hours(day.seconds),
      day.sessions,
      day.seconds > 0 ? "Yes" : "No",
      dailyGoalMinutes / 60,
      safePercent(day.seconds, dailyGoalMinutes * 60),
      Object.keys(day.subjects).join(", "),
    ]),
  );
  formatHoursColumn(dailySheet, 4);
  formatHoursColumn(dailySheet, 7);
  dailySheet.getColumn(8).numFmt = '0.00"%"';

  // Weekly analysis
  const weeklySheet = workbook.addWorksheet("Weekly Analysis");
  addTable(
    weeklySheet,
    "WeeklyStudyTable",
    [
      "Week Starting Monday",
      "Total Seconds",
      "Total Hours",
      "Average Per Calendar Day",
      "Average Per Active Day",
      "Active Days",
      "Sessions",
      "Weekly Goal Hours",
      "Goal Achievement %",
    ],
    weekly.map((week) => {
      const goalSeconds = week.goalDays * dailyGoalMinutes * 60;
      return [
        week.week,
        week.totalSeconds,
        week.totalHours,
        week.averagePerCalendarDay,
        week.averagePerActiveDay,
        week.activeDays,
        week.sessions,
        hours(goalSeconds),
        safePercent(week.totalSeconds, goalSeconds),
      ];
    }),
  );
  [3, 4, 5, 8].forEach((column) => formatHoursColumn(weeklySheet, column));
  weeklySheet.getColumn(9).numFmt = '0.00"%"';

  // Subject analysis: count sessions directly from the original session list.
  const subjectSessionCounts = new Map<string, number>();
  for (const session of sessions) {
    subjectSessionCounts.set(
      session.subjectName,
      (subjectSessionCounts.get(session.subjectName) ?? 0) + 1,
    );
  }
  const allStudySeconds = daily.reduce((sum, day) => sum + day.seconds, 0);
  const subjectSheet = workbook.addWorksheet("Subject Analysis");
  addTable(
    subjectSheet,
    "SubjectStudyTable",
    [
      "Subject",
      "Total Seconds",
      "Total Minutes",
      "Total Hours",
      "Share of Study %",
      "Sessions",
      "Average Session Hours",
    ],
    subjects.map((subject) => {
      const count = subjectSessionCounts.get(subject.subject) ?? 0;
      return [
        subject.subject,
        subject.seconds,
        minutes(subject.seconds),
        subject.totalHours,
        safePercent(subject.seconds, allStudySeconds),
        count,
        count > 0 ? hours(subject.seconds / count) : 0,
      ];
    }),
  );
  formatHoursColumn(subjectSheet, 4);
  subjectSheet.getColumn(5).numFmt = '0.00"%"';
  formatHoursColumn(subjectSheet, 7);

  // Raw sessions
  const rawSheet = workbook.addWorksheet("All Sessions");
  addTable(
    rawSheet,
    "AllStudySessions",
    [
      "Session ID",
      "Date",
      "Subject",
      "Topic",
      "Tag",
      "Mode",
      "Started At",
      "Ended At",
      "Start Time",
      "End Time",
      "Duration Seconds",
      "Duration Minutes",
      "Duration Hours",
    ],
    makeRawSessionRows(sessions),
  );
  formatHoursColumn(rawSheet, 13);

  // Dashboard
  const dashboard = workbook.addWorksheet("Dashboard");
  dashboard.views = [{ showGridLines: false }];
  dashboard.mergeCells("A1:H1");
  const title = dashboard.getCell("A1");
  title.value = "STUDYOS • STUDY ANALYTICS";
  title.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
  title.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17365D" },
  };
  title.alignment = { vertical: "middle", horizontal: "left" };
  dashboard.getRow(1).height = 38;

  const todayKey = dateKey(new Date());
  const totalSeconds = allStudySeconds;
  const activeDays = daily.filter((day) => day.seconds > 0).length;
  const totalSessions = sessions.length;
  const todaySeconds = daily.find((day) => day.date === todayKey)?.seconds ?? 0;
  const dailyAverage = average(totalSeconds, daily.length);
  const activeDayAverage = average(totalSeconds, activeDays);
  const weeklyAverage = average(
    weekly.reduce((sum, week) => sum + week.totalSeconds, 0),
    weekly.length,
  );
  const monthSeconds = daily
    .filter((day) => day.date.startsWith(todayKey.slice(0, 7)))
    .reduce((sum, day) => sum + day.seconds, 0);

  // If today has no study yet, continue the streak from yesterday.
  const currentStreak = (() => {
    let cursor = todaySeconds > 0 ? todayKey : addDaysKey(todayKey, -1);
    let streak = 0;
    while (daily.find((day) => day.date === cursor)?.seconds) {
      streak += 1;
      cursor = addDaysKey(cursor, -1);
    }
    return streak;
  })();

  const bestDay = [...daily].sort((a, b) => b.seconds - a.seconds)[0];
  const metrics: (string | number)[][] = [
    ["Metric", "Value"],
    ["Total Study Hours", hours(totalSeconds)],
    ["Today (Hours)", hours(todaySeconds)],
    ["Daily Average (All Days)", hours(dailyAverage)],
    ["Average (Active Days)", hours(activeDayAverage)],
    ["Weekly Average (Hours)", hours(weeklyAverage)],
    ["This Month (Hours)", hours(monthSeconds)],
    ["Total Sessions", totalSessions],
    ["Active Days", activeDays],
    ["Current Streak (Days)", currentStreak],
    ["Daily Goal (Hours)", dailyGoalMinutes / 60],
    [
      "Today Goal Achievement %",
      safePercent(todaySeconds, dailyGoalMinutes * 60),
    ],
    ["Best Study Date", bestDay?.date ?? "N/A"],
    ["Best Study Day (Hours)", hours(bestDay?.seconds ?? 0)],
  ];
  metrics.forEach((row) => dashboard.addRow(row));
  styleHeader(dashboard.getRow(2));
  dashboard.getColumn(1).width = 34;
  dashboard.getColumn(2).width = 24;
  dashboard.getColumn(2).numFmt = "0.00";
  dashboard.getColumn(2).alignment = { horizontal: "left" };
  dashboard.getCell("B13").numFmt = '0.00"%"';

  // Dedicated source data sheet keeps the dashboard uncluttered.
  // Each Excel table starts at a separate column block to avoid overlap.
  const chartData = workbook.addWorksheet("Chart Data");
  chartData.addTable({
    name: "SubjectChartData",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [{ name: "Subject" }, { name: "Hours" }],
    rows: subjects.map((subject) => [subject.subject, subject.totalHours]),
  });
  chartData.addTable({
    name: "WeeklyChartData",
    ref: "D1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [{ name: "Week Starting" }, { name: "Hours" }],
    rows: weekly.map((week) => [week.week, week.totalHours]),
  });
  chartData.addTable({
    name: "DailyChartData",
    ref: "G1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: [{ name: "Date" }, { name: "Hours" }],
    rows: daily.map((day) => [day.date, hours(day.seconds)]),
  });
  chartData.getColumn(1).width = 24;
  chartData.getColumn(2).width = 14;
  chartData.getColumn(4).width = 20;
  chartData.getColumn(5).width = 14;
  chartData.getColumn(7).width = 16;
  chartData.getColumn(8).width = 14;

  // Create charts after ExcelJS has finished writing the workbook.
let buffer: Uint8Array = new Uint8Array(await workbook.xlsx.writeBuffer());
  if (subjects.length > 0) {
    buffer = await addChart(buffer, {
      type: "doughnut",
      title: "Study Time by Subject",
      sheet: "Dashboard",
      categories: `'Chart Data'!$A$2:$A$${subjects.length + 1}`,
      series: [
        {
          name: "Study Hours",
          ref: `'Chart Data'!$B$2:$B$${subjects.length + 1}`,
        },
      ],
      anchor: { col: 0, row: 16 },
      dataLabels: true,
      legend: "b",
    });
  }
  if (weekly.length > 0) {
    buffer = await addChart(buffer, {
      type: "bar",
      title: "Weekly Study Hours",
      sheet: "Dashboard",
      categories: `'Chart Data'!$D$2:$D$${weekly.length + 1}`,
      series: [
        {
          name: "Study Hours",
          ref: `'Chart Data'!$E$2:$E$${weekly.length + 1}`,
        },
      ],
      anchor: { col: 8, row: 16 },
      horizontal: false,
      dataLabels: true,
    });
  }
  if (daily.length > 0) {
    buffer = await addChart(buffer, {
      type: "line",
      title: "Daily Study Trend",
      sheet: "Dashboard",
      categories: `'Chart Data'!$G$2:$G$${daily.length + 1}`,
      series: [
        {
          name: "Study Hours",
          ref: `'Chart Data'!$H$2:$H$${daily.length + 1}`,
        },
      ],
      anchor: { col: 0, row: 38 },
      dataLabels: false,
    });
  }

  const output = new Uint8Array(buffer);
  downloadBlob(
    new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `studyos-analytics-${dateKey(new Date())}.xlsx`,
  );
}
