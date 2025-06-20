module.exports = {
    /**
     * Gets current time in GMT+3 timezone
     * @returns {Date} Current time adjusted to GMT+3
     */
    getCurrentTimeGMT3: function() {
        const now = new Date();
        // Convert to GMT+3 (add 3 hours to UTC)
        const gmt3Time = new Date(now.getTime() + (3 * 60 * 60 * 1000));
        return gmt3Time;
    },

    /**
     * Checks if current time is within the optimal reboot window (9:00-11:00 GMT+3)
     * @returns {object} Object containing window status and timing info
     */
    checkRebootWindow: function() {
        const currentTime = this.getCurrentTimeGMT3();
        const hour = currentTime.getUTCHours();
        const minute = currentTime.getUTCMinutes();
        
        const isInWindow = hour >= 9 && hour < 11;
        const isAfterDeadline = hour > 10 || (hour === 10 && minute >= 30);
        const isInOptimalTime = hour >= 9 && (hour < 10 || (hour === 10 && minute < 30));
        
        return {
            isInWindow,
            isAfterDeadline,
            isInOptimalTime,
            currentHour: hour,
            currentMinute: minute,
            timeString: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} GMT+3`
        };
    },

    /**
     * Calculates time until next reboot window
     * @returns {number} Minutes until next 9:00 GMT+3
     */
    minutesUntilNextWindow: function() {
        const currentTime = this.getCurrentTimeGMT3();
        const hour = currentTime.getUTCHours();
        const minute = currentTime.getUTCMinutes();
        
        if (hour < 9) {
            // Same day
            return (9 - hour) * 60 - minute;
        } else {
            // Next day
            return (24 - hour + 9) * 60 - minute;
        }
    },

    /**
     * Formats duration in milliseconds to human readable string
     * @param {number} duration Duration in milliseconds
     * @returns {string} Human readable duration
     */
    formatDuration: function(duration) {
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    },

    /**
     * Gets today's date string for database keys
     * @returns {string} Date string in YYYY-MM-DD format (GMT+3)
     */
    getTodayDateString: function() {
        const currentTime = this.getCurrentTimeGMT3();
        const year = currentTime.getUTCFullYear();
        const month = (currentTime.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = currentTime.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};