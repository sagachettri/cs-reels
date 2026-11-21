// Minutes the student's clock is ahead of UTC (India = 330). Sent to the server so
// "today" and streaks follow the student's own midnight.
export const tzOffsetMinutes = () => -new Date().getTimezoneOffset() || 0;
