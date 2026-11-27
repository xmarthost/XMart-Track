package org.traccar.api.resource;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class BackupResourceTest {

    @Test
    public void testParseInstallerUrl() {
        var db = BackupResource.parse("jdbc:mysql://localhost/xmarttrack?zeroDateTimeBehavior=round&serverTimezone=UTC",
                "xmarttrack", "secret");
        assertEquals("localhost", db.host());
        assertEquals("3306", db.port());
        assertEquals("xmarttrack", db.name());
    }

    @Test
    public void testParsePort() {
        var db = BackupResource.parse("jdbc:mariadb://10.0.0.5:3307/gps", "u", "p");
        assertEquals("10.0.0.5", db.host());
        assertEquals("3307", db.port());
        assertEquals("gps", db.name());
    }

    @Test
    public void testOtherDatabase() {
        assertThrows(IllegalStateException.class, () -> BackupResource.parse("jdbc:h2:./data/database", "sa", ""));
    }

}
