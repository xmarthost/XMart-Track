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
package org.traccar.notificators;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.helper.WebHelper;
import org.traccar.helper.model.UserUtil;
import org.traccar.model.Device;
import org.traccar.model.Event;
import org.traccar.model.Position;
import org.traccar.model.Server;
import org.traccar.model.User;
import org.traccar.notification.MessageException;
import org.traccar.notification.NotificationFormatter;
import org.traccar.notification.NotificationMessage;
import org.traccar.session.cache.CacheManager;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonReader;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.Form;
import java.io.StringReader;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Sends notifications to WhatsApp through the XMart Sender API (xmartsender.com).
 * Configured from the web interface (server attributes); recipients are the numbers
 * in the user attribute "xm.whatsappNumbers".
 */
@Singleton
public class NotificatorXmartWhatsapp extends Notificator {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificatorXmartWhatsapp.class);

    public static final String KEY_URL = "xm.wa.url";
    public static final String KEY_SECRET = "xm.wa.secret";
    public static final String KEY_ACCOUNT = "xm.wa.account";
    public static final String KEY_NUMBERS = "xm.whatsappNumbers";
    public static final String DEFAULT_URL = "https://xmartsender.com/api/send/whatsapp";

    private static final Map<String, String> TITLES = Map.ofEntries(
            Map.entry(Event.TYPE_IGNITION_ON, "🟢 Vehicle started (ACC ON)"),
            Map.entry(Event.TYPE_IGNITION_OFF, "🔴 Vehicle stopped (ACC OFF)"),
            Map.entry(Event.TYPE_DEVICE_OVERSPEED, "⚠️ Overspeed"),
            Map.entry(Event.TYPE_GEOFENCE_ENTER, "📥 Entered geofence"),
            Map.entry(Event.TYPE_GEOFENCE_EXIT, "📤 Left geofence"),
            Map.entry(Event.TYPE_ALARM, "🚨 Alarm"),
            Map.entry(Event.TYPE_DEVICE_ONLINE, "🟢 Device online"),
            Map.entry(Event.TYPE_DEVICE_OFFLINE, "⚪ Device offline"),
            Map.entry(Event.TYPE_DEVICE_MOVING, "🚗 Vehicle moving"),
            Map.entry(Event.TYPE_DEVICE_STOPPED, "🅿️ Vehicle stopped"),
            Map.entry(Event.TYPE_COMMAND_RESULT, "💬 Command result"),
            Map.entry("test", "✅ Test message from XMart Track"));

    private final Client client;
    private final CacheManager cacheManager;

    @Inject
    public NotificatorXmartWhatsapp(
            NotificationFormatter notificationFormatter, Client client, CacheManager cacheManager) {
        super(notificationFormatter);
        this.client = client;
        this.cacheManager = cacheManager;
    }

    static List<String> parseNumbers(String value) {
        if (value == null) {
            return List.of();
        }
        return Arrays.stream(value.split("[,;\\s]+"))
                .map(number -> number.replaceAll("[^0-9]", ""))
                .filter(number -> !number.isEmpty())
                .distinct()
                .toList();
    }

    String buildMessage(Server server, User user, Event event, Position position) {
        Device device = cacheManager.getObject(Device.class, event.getDeviceId());
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US);
        dateFormat.setTimeZone(UserUtil.getTimezone(server, user));

        String title = TITLES.getOrDefault(event.getType(), "🔔 " + event.getType());
        if (Event.TYPE_ALARM.equals(event.getType()) && event.getString(Position.KEY_ALARM) != null) {
            title += ": " + event.getString(Position.KEY_ALARM);
        }

        StringBuilder message = new StringBuilder();
        message.append("🚘 *").append(device != null ? device.getName() : "Vehicle").append("*\n");
        message.append(title).append('\n');
        message.append("🕒 ").append(dateFormat.format(event.getEventTime())).append('\n');
        if (position != null) {
            if (Event.TYPE_DEVICE_OVERSPEED.equals(event.getType()) || position.getSpeed() > 0) {
                message.append(String.format(Locale.US, "⚡ Speed: %.0f km/h%n", position.getSpeed() * 1.852));
            }
            if (position.getAddress() != null && !position.getAddress().isBlank()) {
                message.append("📍 ").append(position.getAddress()).append('\n');
            }
            message.append(String.format(Locale.US, "🗺️ https://maps.google.com/maps?q=%.6f,%.6f",
                    position.getLatitude(), position.getLongitude()));
        }
        message.append("\n\n_XMart Track_");
        return message.toString();
    }

    static boolean isSuccess(String body) {
        if (body == null || body.isBlank()) {
            return true;
        }
        try (JsonReader reader = Json.createReader(new StringReader(body))) {
            JsonObject json = reader.readObject();
            return !json.containsKey("status") || json.getInt("status", 200) == 200;
        } catch (RuntimeException e) {
            return true;
        }
    }

    @Override
    public CompletableFuture<Void> sendAsync(
            User user, NotificationMessage shortMessage, Event event, Position position) {
        List<String> numbers = parseNumbers(user.getString(KEY_NUMBERS));
        if (numbers.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }
        Server server = cacheManager.getServer();
        String secret = server.getString(KEY_SECRET);
        String account = server.getString(KEY_ACCOUNT);
        if (secret == null || secret.isBlank() || account == null || account.isBlank()) {
            return CompletableFuture.failedFuture(new MessageException("XMart Sender WhatsApp is not configured"));
        }
        String url = server.getString(KEY_URL, DEFAULT_URL);
        String text = buildMessage(server, user, event, position);

        CompletableFuture<?>[] futures = numbers.stream().map(number -> {
            Form form = new Form()
                    .param("secret", secret)
                    .param("account", account)
                    .param("recipient", number)
                    .param("type", "text")
                    .param("priority", "1")
                    .param("message", text);
            return WebHelper.post(client.target(url).request(), Entity.form(form), response -> {
                String body = response.readEntity(String.class);
                // XMart Sender can answer HTTP 200 with an error status inside the JSON body
                if (response.getStatus() / 100 != 2 || !isSuccess(body)) {
                    throw new MessageException("XMart Sender (" + number + "): " + body);
                }
                LOGGER.info("XMart Sender WhatsApp sent to {} ({})", number, event.getType());
            });
        }).toArray(CompletableFuture[]::new);
        return CompletableFuture.allOf(futures);
    }

}
