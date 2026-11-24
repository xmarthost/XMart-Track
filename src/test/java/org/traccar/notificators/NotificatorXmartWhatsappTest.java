package org.traccar.notificators;

import org.junit.jupiter.api.Test;
import org.traccar.model.Event;
import org.traccar.model.Position;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class NotificatorXmartWhatsappTest {

    @Test
    public void testTitles() {
        assertEquals("🟢 Vehicle started (ACC ON)",
                NotificatorXmartWhatsapp.titleFor(new Event(Event.TYPE_IGNITION_ON, 1)));
        assertEquals("🔴 Vehicle stopped (ACC OFF)",
                NotificatorXmartWhatsapp.titleFor(new Event(Event.TYPE_IGNITION_OFF, 1)));
        Event alarm = new Event(Event.TYPE_ALARM, 1);
        alarm.set(Position.KEY_ALARM, Position.ALARM_VIBRATION);
        assertEquals("🚨 Alarm: vibration", NotificatorXmartWhatsapp.titleFor(alarm));
        assertTrue(NotificatorXmartWhatsapp.titleFor(new Event("somethingNew", 1)).endsWith("somethingNew"));
    }

    @Test
    public void testNumbers() {
        assertEquals(java.util.List.of("923001234567", "923331234567"),
                NotificatorXmartWhatsapp.parseNumbers("+923001234567, 923331234567"));
    }

}
