YYYY-MM-DD — Global Error Handling
        Learning: Express does not automatically handle uncaught synchronous errors cleanly. Malformed URIs caused Express to crash and leak internal HTML stack traces instead of providing standard JSON error responses. Unhandled `new URL()` instantiation errors would completely stop request handling and crash the server.
        Action: Implement standard global Express error handlers as the last middleware step to catch these generic framework errors and serialize them as JSON. Wrap synchronous URL parsing in try/catc

        // ... 17021.8 characters truncated (middle section) ...

        hen reading files with 'utf8' string encoding followed by `res.send()` execution. `res.send` applies dynamic typing inferences, converting variables back into buffers and calculating lengths dynamically. By contrast, node native file-system emits `Buffer` references directly which node core web modules can pipe to the TCP stream efficiently without intervening conversion logic.

        Action:
        Read mock payloads as raw `Buffer` references using `fs.promises.readFile` and transmit directly with `.setHeader` and `.end` node HTTP module utilities.