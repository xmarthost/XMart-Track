package org.traccar.notificators;

import org.junit.jupiter.api.Test;
import org.traccar.model.Device;
import org.traccar.model.Event;
import org.traccar.model.Position;
import org.traccar.model.User;

import java.util.List;

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

    @Test
    public void testRecipients() {
        User user = new User();
        user.set(NotificatorXmartWhatsapp.KEY_NUMBERS, "923000000001");
        Device device = new Device();
        assertEquals(List.of("923000000001"), NotificatorXmartWhatsapp.recipients(device, user));
        device.set(NotificatorXmartWhatsapp.KEY_NUMBERS, "+923000000002");
        assertEquals(List.of("923000000002"), NotificatorXmartWhatsapp.recipients(device, user));
        device.set(NotificatorXmartWhatsapp.KEY_ALSO_ACCOUNT, true);
        assertEquals(List.of("923000000002", "923000000001"), NotificatorXmartWhatsapp.recipients(device, user));
        assertEquals(List.of("923000000001"), NotificatorXmartWhatsapp.recipients(null, user));
    }

}
