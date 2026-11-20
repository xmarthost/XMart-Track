/*
 * Copyright 2017 - 2024 Anton Tananaev (anton@traccar.org)
 * Copyright 2017 - 2018 Andrey Kunitsyn (andrey@traccar.org)
 *
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

import org.traccar.database.StatisticsManager;
import org.traccar.model.Event;
import org.traccar.model.Position;
import org.traccar.model.User;
import org.traccar.notification.NotificationFormatter;
import org.traccar.notification.NotificationMessage;
import org.traccar.sms.SmsManager;

import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Singleton
public class NotificatorSms extends Notificator {

    private final SmsManager smsManager;
    private final StatisticsManager statisticsManager;

    @Inject
    public NotificatorSms(
            SmsManager smsManager, NotificationFormatter notificationFormatter, StatisticsManager statisticsManager) {
        super(notificationFormatter);
        this.smsManager = smsManager;
        this.statisticsManager = statisticsManager;
    }

    @Override
    public CompletableFuture<Void> sendAsync(User user, NotificationMessage message, Event event, Position position) {
        if (user.getPhone() == null || user.getPhone().isBlank()) {
            return CompletableFuture.completedFuture(null);
        }
        // XMart: the phone field may hold several numbers separated by comma, semicolon or space
        List<String> phones = Arrays.stream(user.getPhone().split("[,;\\s]+"))
                .map(String::trim)
                .filter(phone -> !phone.isEmpty())
                .distinct()
                .toList();
        CompletableFuture<?>[] futures = phones.stream()
                .map(phone -> {
                    statisticsManager.registerSms();
                    return smsManager.sendMessage(phone, message.digest(), false);
                })
                .toArray(CompletableFuture[]::new);
        return CompletableFuture.allOf(futures);
    }

}
