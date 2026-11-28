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
package org.traccar.schedule;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.session.cache.CacheManager;

import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;

/**
 * XMart: deletes location history and events older than the number of days set in the web panel
 * (server attribute "xm.historyDays", 0 or empty = keep everything). The latest position of every
 * vehicle is always kept. Runs every 6 hours in small batches.
 */
public class TaskHistoryCleanup extends SingleScheduleTask {

    private static final Logger LOGGER = LoggerFactory.getLogger(TaskHistoryCleanup.class);

    public static final String KEY_HISTORY_DAYS = "xm.historyDays";
    private static final long PERIOD_HOURS = 6;
    private static final int BATCH = 5000;

    private final CacheManager cacheManager;
    private final DataSource dataSource;

    @Inject
    public TaskHistoryCleanup(CacheManager cacheManager, DataSource dataSource) {
        this.cacheManager = cacheManager;
        this.dataSource = dataSource;
    }

    @Override
    public void schedule(ScheduledExecutorService executor) {
        executor.scheduleAtFixedRate(this, 10, PERIOD_HOURS * 60, TimeUnit.MINUTES);
    }

    private int deleteBatches(Connection connection, String sql, Timestamp cutoff) throws SQLException {
        int total = 0;
        int deleted;
        do {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setTimestamp(1, cutoff);
                deleted = statement.executeUpdate();
            }
            total += deleted;
        } while (deleted >= BATCH);
        return total;
    }

    @Override
    public void run() {
        int days = cacheManager.getServer().getInteger(KEY_HISTORY_DAYS);
        if (days <= 0) {
            return;
        }
        Timestamp cutoff = new Timestamp(System.currentTimeMillis() - days * 24L * 3600 * 1000);
        try (Connection connection = dataSource.getConnection()) {
            int positions = deleteBatches(connection,
                    "DELETE FROM tc_positions WHERE fixtime < ? AND id NOT IN "
                    + "(SELECT positionid FROM tc_devices WHERE positionid IS NOT NULL) LIMIT " + BATCH, cutoff);
            int events = deleteBatches(connection,
                    "DELETE FROM tc_events WHERE eventtime < ? LIMIT " + BATCH, cutoff);
            if (positions > 0 || events > 0) {
                LOGGER.info("History cleanup: {} positions and {} events older than {} days deleted",
                        positions, events, days);
            }
        } catch (SQLException e) {
            LOGGER.warn("History cleanup failed", e);
        }
    }

}
