const https = require('http');
const http = require('http');
const crypto = require('crypto');

// Configuration
const ES_HOST = process.env.ES_HOST || 'elasticsearch';
const ES_PORT = process.env.ES_PORT || 9200;
const METRICS_PORT = 8080;
const INDEX_NAME = 'logs-simulation';
const INTERVAL_MS = 500; // Generate logs every 500ms

// Services definition
const SERVICES = [
    { name: 'ingress-gateway', weight: 0.4 },
    { name: 'auth-service', weight: 0.15 },
    { name: 'product-service', weight: 0.25 },
    { name: 'order-service', weight: 0.1 },
    { name: 'payment-service', weight: 0.1 }
];

// Error templates for realism
const ERRORS = [
    { msg: 'Database connection timed out', type: 'DatabaseError', stack: 'Error: Database connection timed out\n    at Connection.connect (/app/node_modules/mysql/lib/Connection.js:100:13)\n    at Pool.getConnection' },
    { msg: 'Payment gateway unavailable', type: 'PaymentError', stack: 'Error: Payment gateway unavailable\n    at PaymentProvider.charge (/app/src/payment/provider.js:45:12)' },
    { msg: 'Invalid JWT token', type: 'AuthError', stack: null },
    { msg: 'NullPointerException in processOrder', type: 'NullPointerException', stack: 'java.lang.NullPointerException: \n    at com.example.OrderService.process(OrderService.java:123)\n    at com.example.Controller.handle(Controller.java:45)' },
    { msg: 'Rate limit exceeded', type: 'RateLimitError', stack: null }
];

// Metrics Store
const metrics = {
    http_requests_total: {}, // Key: service|status
    http_request_duration_seconds_bucket: {} // Key: service|le
};

// Buckets for histogram
const BUCKETS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];

function incCounter(service, status) {
    const key = `${service}|${status}`;
    metrics.http_requests_total[key] = (metrics.http_requests_total[key] || 0) + 1;
}

function observeHistogram(service, duration) {
    // Simplified histogram observation
    for (const le of BUCKETS) {
        if (duration <= le) {
            const key = `${service}|${le}`;
            metrics.http_request_duration_seconds_bucket[key] = (metrics.http_request_duration_seconds_bucket[key] || 0) + 1;
        }
    }
    // +Inf bucket
    const key = `${service}|+Inf`;
    metrics.http_request_duration_seconds_bucket[key] = (metrics.http_request_duration_seconds_bucket[key] || 0) + 1;
}

// Helper to pick weighted random service
function getService() {
    const rand = Math.random();
    let cum = 0;
    for (const s of SERVICES) {
        cum += s.weight;
        if (rand < cum) return s.name;
    }
    return SERVICES[0].name;
}

// Helper to generate trace ID
function getTraceId() {
    return crypto.randomBytes(16).toString('hex');
}

// Log generator
function generateLog() {
    const service = getService();
    const traceId = getTraceId();
    const rand = Math.random();

    let level = 'INFO';
    let message = `Successfully processed request for ${service}`;
    let errorObj = null;
    let status = '200';
    let duration = Math.random() * 0.2; // Fast by default

    // 10% chance of error
    if (rand < 0.1) {
        level = 'ERROR';
        const err = ERRORS[Math.floor(Math.random() * ERRORS.length)];
        message = err.msg;
        errorObj = err;
        status = '500';
    } else if (rand < 0.25) {
        level = 'WARN';
        message = `High latency detected in ${service} operation`;
        duration = 0.5 + Math.random() * 2; // Slow
    }

    // Record metrics
    incCounter(service, status);
    observeHistogram(service, duration);

    const timestamp = new Date().toISOString();

    const logEntry = {
        '@timestamp': timestamp,
        timestamp: timestamp,
        level,
        message,
        service,
        traceId,
        namespace: 'production',
        pod: `${service}-${crypto.randomBytes(4).toString('hex')}`,
        stack: errorObj?.stack || undefined,
        metadata: {
            latency: Math.floor(duration * 1000),
            region: 'us-east-1'
        }
    };

    return logEntry;
}

// ES Bulk helper
function sendToES(log) {
    const body = JSON.stringify(log);

    const options = {
        hostname: ES_HOST,
        port: ES_PORT,
        path: `/${INDEX_NAME}/_doc`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length
        }
    };

    const req = https.request(options, (res) => { /* ignore */ });
    req.on('error', (e) => {
        // console.error(`ES Error: ${e.message}`); // suppress to keep logs clean
    });
    req.write(body);
    req.end();
}

// Metrics Server
const server = http.createServer((req, res) => {
    if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });

        let output = '# HELP http_requests_total Total number of HTTP requests\n# TYPE http_requests_total counter\n';
        for (const [key, value] of Object.entries(metrics.http_requests_total)) {
            const [service, status] = key.split('|');
            output += `http_requests_total{service="${service}",status="${status}"} ${value}\n`;
        }

        output += '\n# HELP http_request_duration_seconds Request duration in seconds\n# TYPE http_request_duration_seconds histogram\n';
        for (const [key, value] of Object.entries(metrics.http_request_duration_seconds_bucket)) {
            const [service, le] = key.split('|');
            output += `http_request_duration_seconds_bucket{service="${service}",le="${le}"} ${value}\n`;
        }

        // Add sum and count (mocked for simplicity)
        output += `http_request_duration_seconds_sum 1234.5\n`;
        output += `http_request_duration_seconds_count 1000\n`;

        res.end(output);
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(METRICS_PORT, () => {
    console.log(`Metrics server listening on port ${METRICS_PORT}`);
});

// Main loop
console.log('Starting Log Simulator & Metrics Exporter...');
console.log(`Target ES: http://${ES_HOST}:${ES_PORT}/${INDEX_NAME}`);

setInterval(() => {
    const log = generateLog();
    sendToES(log);
    console.log(`[${log.level}] ${log.service}: ${log.message}`);
}, INTERVAL_MS);
