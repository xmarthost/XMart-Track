/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.traccar.handler.events;

import org.traccar.model.Device;
import org.traccar.model.Event;
import org.traccar.model.Position;
import org.traccar.session.cache.CacheManager;

import jakarta.inject.Inject;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * XMart: alarm when a parked vehicle moves (ignition OFF but a real GPS fix with speed), e.g. towing or theft
 * at night. Switched on per vehicle with the device attribute "xm.parkAlarm"; one alarm per 15 minutes.
 */
public class ParkMovementEventHandler extends BasePositionEventHandler {

    public static final String KEY_PARK_ALARM = "xm.parkAlarm";
    static final double MIN_SPEED_KNOTS = 10 / 1.852; // 10 km/h
    static final long COOLDOWN_MS = 15 * 60 * 1000;

    private final Map<Long, Long> lastAlarm = new ConcurrentHashMap<>();

    @Inject
    public ParkMovementEventHandler(CacheManager cacheManager) {
        super(cacheManager);
    }

    static boolean movingWhileParked(Position position) {
        return position.hasAttribute(Position.KEY_IGNITION)
                && !position.getBoolean(Position.KEY_IGNITION)
                && position.getValid()
                && (!position.hasAttribute(Position.KEY_SATELLITES) || position.getInteger(Position.KEY_SATELLITES) > 0)
                && position.getSpeed() >= MIN_SPEED_KNOTS;
    }

    @Override
    protected void onPosition(Position position, Position lastPosition, Callback callback) {
        Device device = cacheManager.getObject(Device.class, position.getDeviceId());
        if (device == null || !device.getBoolean(KEY_PARK_ALARM) || !movingWhileParked(position)) {
            return;
        }
        long now = System.currentTimeMillis();
        Long last = lastAlarm.get(device.getId());
        if (last != null && now - last < COOLDOWN_MS) {
            return;
        }
        lastAlarm.put(device.getId(), now);
        Event event = new Event(Event.TYPE_ALARM, position);
        event.set(Position.KEY_ALARM, Position.ALARM_MOVEMENT);
        callback.eventDetected(event);
    }

}
