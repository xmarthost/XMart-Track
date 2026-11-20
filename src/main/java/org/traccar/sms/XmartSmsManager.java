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
package org.traccar.sms;

import org.traccar.model.Server;
import org.traccar.notification.MessageException;
import org.traccar.session.cache.CacheManager;

import jakarta.ws.rs.client.Client;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * SMS manager that lets administrators configure an HTTP SMS gateway from the web
 * interface (server attributes), falling back to the gateway from the config file.
 */
public class XmartSmsManager implements SmsManager {

    public static final String KEY_URL = "xm.sms.url";
    public static final String KEY_TEMPLATE = "xm.sms.template";
    public static final String KEY_AUTHORIZATION_HEADER = "xm.sms.authorizationHeader";
    public static final String KEY_AUTHORIZATION = "xm.sms.authorization";
    public static final String KEY_ENABLED = "xm.sms.enabled";

    private final Client client;
    private final CacheManager cacheManager;
    private final SmsManager fallback;

    private String cachedKey;
    private HttpSmsClient cachedClient;

    public XmartSmsManager(Client client, CacheManager cacheManager, SmsManager fallback) {
        this.client = client;
        this.cacheManager = cacheManager;
        this.fallback = fallback;
    }

    private synchronized SmsManager resolve() {
        Server server = cacheManager.getServer();
        String url = server != null ? server.getString(KEY_URL) : null;
        if (url == null || url.isBlank()) {
            return fallback;
        }
        String template = Objects.requireNonNullElse(server.getString(KEY_TEMPLATE), "");
        String header = server.getString(KEY_AUTHORIZATION_HEADER);
        String authorization = server.getString(KEY_AUTHORIZATION);
        String key = String.join("\n", url, template, String.valueOf(header), String.valueOf(authorization));
        if (!key.equals(cachedKey)) {
            cachedClient = new HttpSmsClient(
                    client, url.trim(), header, authorization != null && !authorization.isBlank()
                    ? authorization : null, template);
            cachedKey = key;
        }
        return cachedClient;
    }

    @Override
    public CompletableFuture<Void> sendMessage(String phone, String message, boolean command) {
        Server server = cacheManager.getServer();
        if (server != null && !server.getBoolean(KEY_ENABLED) && server.hasAttribute(KEY_ENABLED)) {
            return CompletableFuture.completedFuture(null);
        }
        SmsManager manager = resolve();
        if (manager == null) {
            return CompletableFuture.failedFuture(new MessageException("SMS gateway is not configured"));
        }
        return manager.sendMessage(phone, message, command);
    }

}
