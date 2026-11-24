package org.traccar.calendar;

import org.junit.jupiter.api.Test;
import org.traccar.model.Calendar;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Calendars as written by the app's geofence schedule (mobile/src/state/geofenceSchedule.js).
public class XmartGeofenceScheduleTest {

    private static Calendar calendar(String body) throws Exception {
        Calendar calendar = new Calendar();
        calendar.setData(("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//XMart Track//Geofence schedule//EN\r\n"
                + "BEGIN:VEVENT\r\nUID:xmart-1@xmarttrack\r\nDTSTAMP:20261124T214302Z\r\n" + body
                + "SUMMARY:Home\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n").getBytes(StandardCharsets.US_ASCII));
        return calendar;
    }

    private static Date at(String iso) {
        return Date.from(java.time.Instant.parse(iso));
    }

    @Test
    public void testDailyNightWindow() throws Exception {
        // 22:00-06:00 PKT every night until 31 Jan 2027
        Calendar c = calendar("DTSTART:20261124T170000Z\r\nDTEND:20261125T010000Z\r\n"
                + "RRULE:FREQ=DAILY;UNTIL=20270131T185900Z\r\n");
        assertTrue(c.checkMoment(at("2026-12-10T20:00:00Z")));   // 01:00 PKT
        assertFalse(c.checkMoment(at("2026-12-10T08:00:00Z")));  // 13:00 PKT
        assertFalse(c.checkMoment(at("2027-02-10T20:00:00Z")));  // after the last day
    }

    @Test
    public void testChosenDays() throws Exception {
        // Mon and Wed 02:00-06:00 PKT, written as Sun and Tue 21:00-01:00 UTC
        Calendar c = calendar("DTSTART:20261124T210000Z\r\nDTEND:20261125T010000Z\r\n"
                + "RRULE:FREQ=WEEKLY;BYDAY=SU,TU\r\n");
        assertTrue(c.checkMoment(at("2026-11-29T22:00:00Z")));   // Mon 03:00 PKT
        assertTrue(c.checkMoment(at("2026-12-01T23:30:00Z")));   // Wed 04:30 PKT
        assertFalse(c.checkMoment(at("2026-11-30T22:00:00Z")));  // Tue 03:00 PKT
        assertFalse(c.checkMoment(at("2026-11-30T03:00:00Z")));  // Mon 08:00 PKT
    }

    @Test
    public void testOneTime() throws Exception {
        Calendar c = calendar("DTSTART:20261124T214300Z\r\nDTEND:20261124T234300Z\r\n");
        assertTrue(c.checkMoment(at("2026-11-24T22:00:00Z")));
        assertFalse(c.checkMoment(at("2026-11-25T00:00:00Z")));
    }

}
