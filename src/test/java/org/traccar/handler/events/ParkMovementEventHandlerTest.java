package org.traccar.handler.events;

import org.junit.jupiter.api.Test;
import org.traccar.model.Position;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ParkMovementEventHandlerTest {

    private static Position position(Boolean ignition, double kmh, boolean valid, int sats) {
        Position p = new Position();
        if (ignition != null) {
            p.set(Position.KEY_IGNITION, ignition);
        }
        p.setSpeed(kmh / 1.852);
        p.setValid(valid);
        p.set(Position.KEY_SATELLITES, sats);
        return p;
    }

    @Test
    public void testMovingWhileParked() {
        assertTrue(ParkMovementEventHandler.movingWhileParked(position(false, 25, true, 8)));
        assertFalse(ParkMovementEventHandler.movingWhileParked(position(true, 25, true, 8)));
        assertFalse(ParkMovementEventHandler.movingWhileParked(position(false, 4, true, 8)));
        assertFalse(ParkMovementEventHandler.movingWhileParked(position(false, 25, false, 8)));
        assertFalse(ParkMovementEventHandler.movingWhileParked(position(false, 25, true, 0)));
        assertFalse(ParkMovementEventHandler.movingWhileParked(position(null, 25, true, 8)));
    }

}
