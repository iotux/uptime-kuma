const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { SystemServiceMonitorType } = require("../../server/monitor-types/system-service");
const { DOWN, UP } = require("../../src/util");
const process = require("process");

describe("SystemServiceMonitorType", () => {
    let monitorType;
    let heartbeat;
    let originalPlatform;

    beforeEach(() => {
        monitorType = new SystemServiceMonitorType();
        heartbeat = {
            status: DOWN,
            msg: "",
        };
        originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    });

    afterEach(() => {
        if (originalPlatform) {
            Object.defineProperty(process, "platform", originalPlatform);
        }
    });

    it("should detect a running service", async (t) => {
        // Requirement: Use REAL system tools (no mocks).
        // Therefore, we must skip this test on platforms that lack systemd/PowerShell (like macOS).
        if (process.platform !== "linux" && process.platform !== "win32") {
            t.skip("Skipping integration test: Real systemd/PowerShell not available on this platform");
            return;
        }

        const isWin = process.platform === "win32";
        let serviceName = "myservice";

        if (isWin) {
            // Windows: Test against 'Dnscache' (DNS Client), guaranteed to be running.
            serviceName = "Dnscache";
        } else {
            // Linux: Test against 'systemd-journald', a core service of systemd.
            serviceName = "systemd-journald";
        }

        const monitor = {
            system_service_name: serviceName,
        };

        await monitorType.check(monitor, heartbeat);

        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("is running"));
    });

    it("should detect a stopped service", async (t) => {
        if (process.platform !== "linux" && process.platform !== "win32") {
            t.skip("Skipping integration test: Real systemd/PowerShell not available on this platform");
            return;
        }

        // Query a non-existent service to force an error/down state.
        // This works correctly on both 'systemctl' and 'Get-Service'.
        const serviceName = "non-existent-service-12345";

        const monitor = {
            system_service_name: serviceName,
        };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected error
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });

    it("should fail gracefully with invalid characters", async () => {
        Object.defineProperty(process, "platform", {
            value: "linux",
            configurable: true,
        });

        const monitor = {
            system_service_name: "invalid&service;name",
        };

        try {
            await monitorType.check(monitor, heartbeat);
        } catch (e) {
            // Expected validation error
        }

        assert.strictEqual(heartbeat.status, DOWN);
    });

    it("should throw error on unsupported platforms", async () => {
        // This test mocks the platform, so it can run anywhere.
        Object.defineProperty(process, "platform", {
            value: "darwin",
            configurable: true,
        });

        const monitor = {
            system_service_name: "test-service",
        };

        await assert.rejects(async () => await monitorType.check(monitor, heartbeat), /not supported/);
    });
});

