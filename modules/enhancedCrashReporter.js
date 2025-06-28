const fs = require('fs');
const path = require('path');
const os = require('os');

class EnhancedCrashReporter {
    constructor() {
        this.startTime = Date.now();
        this.memorySnapshots = [];
        this.setupMemoryTracking();
    }

    setupMemoryTracking() {
        // Take memory snapshots every minute for trend analysis
        setInterval(() => {
            try {
                const usage = process.memoryUsage();
                this.memorySnapshots.push({
                    timestamp: Date.now(),
                    ...usage
                });
                
                // Keep only last 60 snapshots (1 hour of data)
                if (this.memorySnapshots.length > 60) {
                    this.memorySnapshots.shift();
                }
            } catch (err) {
                // Memory tracking failure shouldn't crash anything
            }
        }, 60000);
    }

    formatTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/:/g, '-').split('.')[0];
    }

    tryGetServiceStatus() {
        const status = {
            discord: 'unknown',
            api: 'unknown',
            mongo: 'unknown',
            schedulers: 'unknown'
        };

        try {
            // Try to get Discord client status
            const bot = require('../discord/bot');
            if (bot && typeof bot.getClient === 'function') {
                bot.getClient().then(client => {
                    status.discord = client && client.isReady() ? 'connected' : 'disconnected';
                }).catch(() => {
                    status.discord = 'error';
                });
            }
        } catch (err) {
            status.discord = 'error';
        }

        try {
            // Try to check MongoDB connection
            const mongo = require('./mongo');
            if (mongo && mongo.mainClientConnected) {
                status.mongo = 'connected';
            } else {
                status.mongo = 'disconnected';
            }
        } catch (err) {
            status.mongo = 'error';
        }

        return status;
    }

    tryGetRecentLogs() {
        try {
            const sessionLogger = require('./sessionLogger');
            return sessionLogger.getRecentLogs(50);
        } catch (err) {
            return ['[Error retrieving recent logs: ' + err.message + ']'];
        }
    }

    getSystemInfo() {
        try {
            return {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid,
                ppid: process.ppid,
                cwd: process.cwd(),
                uptime: process.uptime(),
                sessionDuration: Date.now() - this.startTime,
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpus: os.cpus().length,
                loadAverage: os.loadavg(),
                hostname: os.hostname(),
                networkInterfaces: Object.keys(os.networkInterfaces())
            };
        } catch (err) {
            return {
                error: 'Could not collect system info: ' + err.message,
                nodeVersion: process.version || 'unknown',
                platform: process.platform || 'unknown',
                pid: process.pid || 'unknown'
            };
        }
    }

    getMemoryTrend() {
        if (this.memorySnapshots.length < 2) {
            return 'Insufficient data for memory trend analysis';
        }

        const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
        const oldest = this.memorySnapshots[0];
        const heapGrowth = latest.heapUsed - oldest.heapUsed;
        const rssGrowth = latest.rss - oldest.rss;
        const timeSpan = latest.timestamp - oldest.timestamp;

        return {
            snapshots: this.memorySnapshots.length,
            timeSpanMinutes: Math.round(timeSpan / 60000),
            heapGrowthMB: Math.round(heapGrowth / 1024 / 1024),
            rssGrowthMB: Math.round(rssGrowth / 1024 / 1024),
            currentHeapMB: Math.round(latest.heapUsed / 1024 / 1024),
            currentRssMB: Math.round(latest.rss / 1024 / 1024),
            trend: heapGrowth > 50 * 1024 * 1024 ? 'GROWING' : 'STABLE'
        };
    }

    generateDetailedCrashReport(error) {
        const timestamp = this.formatTimestamp();
        const systemInfo = this.getSystemInfo();
        const memoryInfo = process.memoryUsage();
        const memoryTrend = this.getMemoryTrend();
        const serviceStatus = this.tryGetServiceStatus();
        const recentLogs = this.tryGetRecentLogs();

        return `VALHALLA UPDATER CRASH REPORT
Generated: ${new Date().toISOString()}
Report ID: crash_${timestamp}

${'='.repeat(80)}
ERROR INFORMATION
${'='.repeat(80)}

Error Type: ${error.name || 'Unknown'}
Error Message: ${error.message || 'No message'}

Stack Trace:
${error.stack || 'No stack trace available'}

${'='.repeat(80)}
SYSTEM INFORMATION
${'='.repeat(80)}

Node.js Version: ${systemInfo.nodeVersion}
Platform: ${systemInfo.platform} (${systemInfo.arch})
Process ID: ${systemInfo.pid}
Working Directory: ${systemInfo.cwd}
Session Duration: ${Math.round(systemInfo.sessionDuration / 1000)}s
System Uptime: ${Math.round(systemInfo.uptime)}s

Hardware:
- Total Memory: ${Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024)}GB
- Free Memory: ${Math.round(systemInfo.freeMemory / 1024 / 1024 / 1024)}GB
- CPU Cores: ${systemInfo.cpus}
- Load Average: ${systemInfo.loadAverage ? systemInfo.loadAverage.map(l => l.toFixed(2)).join(', ') : 'N/A'}
- Hostname: ${systemInfo.hostname}

${'='.repeat(80)}
MEMORY USAGE
${'='.repeat(80)}

Current Memory Usage:
- RSS: ${Math.round(memoryInfo.rss / 1024 / 1024)}MB
- Heap Total: ${Math.round(memoryInfo.heapTotal / 1024 / 1024)}MB
- Heap Used: ${Math.round(memoryInfo.heapUsed / 1024 / 1024)}MB
- External: ${Math.round(memoryInfo.external / 1024 / 1024)}MB
- Array Buffers: ${Math.round(memoryInfo.arrayBuffers / 1024 / 1024)}MB

Memory Trend Analysis:
${typeof memoryTrend === 'object' ? 
    `- Snapshots: ${memoryTrend.snapshots} over ${memoryTrend.timeSpanMinutes} minutes
- Heap Growth: ${memoryTrend.heapGrowthMB}MB
- RSS Growth: ${memoryTrend.rssGrowthMB}MB
- Current Heap: ${memoryTrend.currentHeapMB}MB
- Current RSS: ${memoryTrend.currentRssMB}MB
- Trend: ${memoryTrend.trend}` : memoryTrend}

${'='.repeat(80)}
SERVICE STATUS
${'='.repeat(80)}

Discord Bot: ${serviceStatus.discord}
MongoDB: ${serviceStatus.mongo}
API Server: ${serviceStatus.api}
Schedulers: ${serviceStatus.schedulers}

${'='.repeat(80)}
RECENT LOG ENTRIES (Last 50)
${'='.repeat(80)}

${recentLogs.join('\n')}

${'='.repeat(80)}
END OF CRASH REPORT
${'='.repeat(80)}
`;
    }

    generateBasicCrashReport(error) {
        const timestamp = this.formatTimestamp();
        const memoryInfo = process.memoryUsage();

        return `VALHALLA UPDATER CRASH REPORT (BASIC)
Generated: ${new Date().toISOString()}
Report ID: crash_${timestamp}

ERROR: ${error.name || 'Unknown'}: ${error.message || 'No message'}

STACK TRACE:
${error.stack || 'No stack trace available'}

SYSTEM:
Node: ${process.version}
Platform: ${process.platform}
PID: ${process.pid}
Memory: ${Math.round(memoryInfo.rss / 1024 / 1024)}MB RSS, ${Math.round(memoryInfo.heapUsed / 1024 / 1024)}MB Heap
`;
    }

    generateEmergencyCrash(error) {
        return `EMERGENCY CRASH LOG ${new Date().toISOString()}
ERROR: ${error.message || 'Unknown error'}
STACK: ${error.stack ? error.stack.split('\n')[0] : 'No stack trace'}
PID: ${process.pid}
`;
    }

    writeToLocation(location, filename, data) {
        try {
            // Ensure directory exists
            if (!fs.existsSync(location)) {
                fs.mkdirSync(location, { recursive: true });
            }
            
            const fullPath = path.join(location, filename);
            fs.writeFileSync(fullPath, data);
            return fullPath;
        } catch (err) {
            throw new Error(`Write failed to ${location}: ${err.message}`);
        }
    }

    sendCrashNotification(error) {
        try {
            // Determine crash severity
            const severity = this.classifyCrashSeverity(error);
            
            // Prepare crash data for Discord notification
            const crashData = {
                error: {
                    name: error.name || 'UnknownError',
                    message: error.message || 'No error message available',
                },
                stack: error.stack,
                severity: severity,
                systemInfo: this.getSystemInfo(),
                memoryInfo: process.memoryUsage(),
                timestamp: new Date().toISOString(),
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
                memoryTrend: this.getMemoryTrend()
            };
            
            // Send notification asynchronously (fire and forget)
            setImmediate(async () => {
                try {
                    const { sendCriticalCrash } = require('./crashNotificationManager');
                    await sendCriticalCrash(crashData);
                } catch (notificationError) {
                    // Notification failures cannot crash the crash reporter
                    console.error('[CRASH REPORTER] Discord notification failed:', notificationError.message);
                }
            });
            
        } catch (err) {
            // Crash notification failures cannot break crash reporting
            console.error('[CRASH REPORTER] Notification preparation failed:', err.message);
        }
    }
    
    /**
     * Classify crash severity for notification purposes
     */
    classifyCrashSeverity(error) {
        try {
            const errorName = (error.name || '').toLowerCase();
            const errorMessage = (error.message || '').toLowerCase();
            const stack = (error.stack || '').toLowerCase();
            
            // CRITICAL: System-level failures, security issues, data corruption
            if (errorName.includes('systemerror') ||
                errorMessage.includes('eacces') ||
                errorMessage.includes('enospc') ||
                errorMessage.includes('corrupted') ||
                errorMessage.includes('segmentation fault') ||
                stack.includes('mongodb') ||
                stack.includes('database')) {
                return 'CRITICAL';
            }
            
            // HIGH: Service failures, network failures, important components
            if (errorName.includes('referenceerror') ||
                errorName.includes('typeerror') ||
                errorMessage.includes('discord') ||
                errorMessage.includes('pterodactyl') ||
                errorMessage.includes('connection') ||
                errorMessage.includes('timeout') ||
                stack.includes('schedulermanager') ||
                stack.includes('bot.js')) {
                return 'HIGH';
            }
            
            // MEDIUM: Parse errors, validation errors, recoverable issues
            if (errorName.includes('syntaxerror') ||
                errorName.includes('validationerror') ||
                errorMessage.includes('parse') ||
                errorMessage.includes('invalid')) {
                return 'MEDIUM';
            }
            
            // LOW: Everything else
            return 'LOW';
            
        } catch (err) {
            // If severity classification fails, default to HIGH for safety
            return 'HIGH';
        }
    }

    handleCrash(error) {
        const timestamp = this.formatTimestamp();
        const filename = `crash_${timestamp}.log`;
        
        // Send Discord notification FIRST (before file operations)
        this.sendCrashNotification(error);
        
        // Layer 1: Try detailed crash report in crash-logs directory
        try {
            const detailedReport = this.generateDetailedCrashReport(error);
            const crashLogsDir = path.join(process.cwd(), 'crash-logs');
            const savedPath = this.writeToLocation(crashLogsDir, filename, detailedReport);
            console.error(`CRASH: Detailed report saved to ${savedPath}`);
            return;
        } catch (err) {
            console.error(`Layer 1 failed: ${err.message}`);
        }

        // Layer 2: Try detailed crash report in logs directory
        try {
            const detailedReport = this.generateDetailedCrashReport(error);
            const logsDir = path.join(process.cwd(), 'logs');
            const savedPath = this.writeToLocation(logsDir, filename, detailedReport);
            console.error(`CRASH: Detailed report saved to ${savedPath}`);
            return;
        } catch (err) {
            console.error(`Layer 2 failed: ${err.message}`);
        }

        // Layer 3: Try basic crash report in /tmp
        try {
            const basicReport = this.generateBasicCrashReport(error);
            const tmpDir = '/tmp';
            const savedPath = this.writeToLocation(tmpDir, `valhalla-${filename}`, basicReport);
            console.error(`CRASH: Basic report saved to ${savedPath}`);
            return;
        } catch (err) {
            console.error(`Layer 3 failed: ${err.message}`);
        }

        // Layer 4: Try basic crash report in home directory
        try {
            const basicReport = this.generateBasicCrashReport(error);
            const homeDir = process.env.HOME || '/tmp';
            const savedPath = this.writeToLocation(homeDir, `valhalla-${filename}`, basicReport);
            console.error(`CRASH: Basic report saved to ${savedPath}`);
            return;
        } catch (err) {
            console.error(`Layer 4 failed: ${err.message}`);
        }

        // Layer 5: Try emergency crash in current directory
        try {
            const emergencyReport = this.generateEmergencyCrash(error);
            const currentDir = process.cwd();
            const savedPath = this.writeToLocation(currentDir, filename, emergencyReport);
            console.error(`CRASH: Emergency report saved to ${savedPath}`);
            return;
        } catch (err) {
            console.error(`Layer 5 failed: ${err.message}`);
        }

        // Layer 6: Console output (guaranteed to work)
        console.error('FATAL CRASH - ALL FILE WRITES FAILED');
        console.error('Error:', error.name, error.message);
        console.error('Stack:', error.stack);
        console.error('PID:', process.pid);
        console.error('Memory RSS:', Math.round(process.memoryUsage().rss / 1024 / 1024), 'MB');
        console.error('Time:', new Date().toISOString());
    }
}

// Create global instance
const crashReporter = new EnhancedCrashReporter();

// Set up crash handlers
process.on('uncaughtException', (error) => {
    console.error('\n!!! UNCAUGHT EXCEPTION !!!');
    crashReporter.handleCrash(error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n!!! UNHANDLED PROMISE REJECTION !!!');
    const error = reason instanceof Error ? reason : new Error(String(reason));
    error.promise = promise;
    crashReporter.handleCrash(error);
    process.exit(1);
});

module.exports = crashReporter;