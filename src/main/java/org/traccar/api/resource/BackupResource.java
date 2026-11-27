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
package org.traccar.api.resource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.traccar.api.BaseResource;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.storage.StorageException;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.StreamingOutput;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Whole-server backup for moving XMart Track to another server (web panel: Settings, Backup).
 * Export streams a gzip MariaDB/MySQL dump of the database (vehicles, history, users, alerts,
 * geofences, settings); import loads such a dump and restarts the server. Administrators only.
 */
@Path("xmart/backup")
public class BackupResource extends BaseResource {

    private static final Logger LOGGER = LoggerFactory.getLogger(BackupResource.class);
    private static final String[] HISTORY_TABLES = {"tc_positions", "tc_events"};

    @Inject
    private Config config;

    record Database(String host, String port, String name, String user, String password) {
    }

    static Database parse(String url, String user, String password) {
        if (url == null || !url.startsWith("jdbc:mysql:") && !url.startsWith("jdbc:mariadb:")) {
            throw new IllegalStateException("Backup works with a MariaDB / MySQL database only");
        }
        URI uri = URI.create(url.substring("jdbc:".length()));
        String host = uri.getHost() != null ? uri.getHost() : "localhost";
        String port = uri.getPort() > 0 ? String.valueOf(uri.getPort()) : "3306";
        String name = uri.getPath() != null ? uri.getPath().replaceFirst("^/", "") : "";
        if (name.isEmpty()) {
            throw new IllegalStateException("No database name in database.url");
        }
        return new Database(host, port, name, user, password);
    }

    private Database database() {
        return parse(config.getString(Keys.DATABASE_URL), config.getString(Keys.DATABASE_USER),
                config.getString(Keys.DATABASE_PASSWORD));
    }

    private static String tool(String... names) {
        for (String name : names) {
            for (String dir : new String[] {"/usr/bin", "/usr/local/bin", "/bin"}) {
                if (new File(dir, name).canExecute()) {
                    return dir + "/" + name;
                }
            }
        }
        return names[names.length - 1];
    }

    private static ProcessBuilder client(Database db, List<String> command) {
        List<String> full = new ArrayList<>(command);
        full.addAll(List.of("-h", db.host(), "-P", db.port(), "-u", db.user()));
        ProcessBuilder builder = new ProcessBuilder(full);
        Map<String, String> environment = builder.environment();
        if (db.password() != null) {
            environment.put("MYSQL_PWD", db.password()); // not visible in the process list
        }
        return builder;
    }

    private static void dump(Database db, List<String> options, List<String> tables, OutputStream out)
            throws IOException {
        List<String> command = new ArrayList<>(List.of(tool("mariadb-dump", "mysqldump"),
                "--single-transaction", "--quick", "--add-drop-table", "--default-character-set=utf8mb4"));
        command.addAll(options);
        ProcessBuilder builder = client(db, command);
        builder.command().add(db.name());
        builder.command().addAll(tables);
        Process process = builder.redirectError(ProcessBuilder.Redirect.PIPE).start();
        try (InputStream in = process.getInputStream()) {
            in.transferTo(out);
        }
        try {
            if (!process.waitFor(10, TimeUnit.MINUTES) || process.exitValue() != 0) {
                String error = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
                throw new IOException("Database export failed: " + error.trim());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException(e);
        }
    }

    @GET
    @Produces("application/gzip")
    public Response exportBackup(@QueryParam("history") Boolean history) throws StorageException {
        permissionsService.checkAdmin(getUserId());
        Database db = database();
        boolean withHistory = history == null || history;
        String name = "xmart-track-backup-" + new SimpleDateFormat("yyyyMMdd-HHmm").format(new Date())
                + (withHistory ? "" : "-no-history") + ".sql.gz";
        StreamingOutput stream = out -> {
            try (GZIPOutputStream gzip = new GZIPOutputStream(out, 65536)) {
                if (withHistory) {
                    dump(db, List.of(), List.of(), gzip);
                } else {
                    List<String> skip = new ArrayList<>();
                    for (String table : HISTORY_TABLES) {
                        skip.add("--ignore-table=" + db.name() + "." + table);
                    }
                    dump(db, skip, List.of(), gzip);
                    // empty history tables, so the restored server has them
                    dump(db, List.of("--no-data"), List.of(HISTORY_TABLES), gzip);
                }
            }
            LOGGER.info("Backup exported by user {} (history {})", getUserId(), withHistory);
        };
        return Response.ok(stream)
                .header("Content-Disposition", "attachment; filename=\"" + name + "\"")
                .build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_OCTET_STREAM)
    @Produces(MediaType.APPLICATION_JSON)
    public Response importBackup(InputStream body) throws Exception {
        permissionsService.checkAdmin(getUserId());
        Database db = database();
        java.nio.file.Path file = Files.createTempFile("xmart-import-", ".sql");
        try {
            try (InputStream in = new BufferedInputStream(body, 65536)) {
                in.mark(2);
                int b1 = in.read();
                int b2 = in.read();
                in.reset();
                InputStream source = b1 == 0x1f && b2 == 0x8b ? new GZIPInputStream(in, 65536) : in;
                Files.copy(source, file, StandardCopyOption.REPLACE_EXISTING);
            }
            byte[] head = new byte[4096];
            int read;
            try (InputStream in = Files.newInputStream(file)) {
                read = Math.max(0, in.readNBytes(head, 0, head.length));
            }
            String start = new String(head, 0, read, StandardCharsets.UTF_8);
            if (!start.contains("dump") || Files.size(file) < 1000) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("error", "This is not an XMart Track backup file (.sql.gz)")).build();
            }
            List<String> command = new ArrayList<>(List.of(tool("mariadb", "mysql"),
                    "--default-character-set=utf8mb4"));
            ProcessBuilder builder = client(db, command);
            builder.command().add(db.name());
            Process process = builder.redirectInput(file.toFile()).redirectErrorStream(true).start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!process.waitFor(30, TimeUnit.MINUTES) || process.exitValue() != 0) {
                LOGGER.warn("Backup import failed: {}", output.trim());
                return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                        .entity(Map.of("error", "Import failed: " + output.trim())).build();
            }
            LOGGER.info("Backup imported by user {}; restarting to load it", getUserId());
            // restart so every cached object is read again from the imported database
            Thread restart = new Thread(() -> {
                try {
                    Thread.sleep(3000);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                System.exit(3);
            }, "xmart-restart");
            restart.setDaemon(true);
            restart.start();
            return Response.ok(Map.of("status", "imported", "restart", true)).build();
        } finally {
            Files.deleteIfExists(file);
        }
    }

}
