package com.oms.narrative.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mirrors your Log POJO: service activity with request/response payloads and timing.
 */
public class Log {

    private String serviceName;
    private String requestURI;
    /** Raw JSON body sent to the service (string form). */
    private String inputRequest;
    /** Raw JSON or error text returned (string form). */
    private String outputResponse;
    /** Latency in milliseconds, if available. */
    private Long durationMs;
    /** ISO-8601 or platform timestamp string for ordering / display. */
    private String timestamp;
    /**
     * HTTP or business headers (e.g. X-User-Email, Currency, X-Currency).
     * Keys are matched case-insensitively by helpers.
     */
    private Map<String, String> headers = new LinkedHashMap<>();

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getRequestURI() {
        return requestURI;
    }

    public void setRequestURI(String requestURI) {
        this.requestURI = requestURI;
    }

    public String getInputRequest() {
        return inputRequest;
    }

    public void setInputRequest(String inputRequest) {
        this.inputRequest = inputRequest;
    }

    public String getOutputResponse() {
        return outputResponse;
    }

    public void setOutputResponse(String outputResponse) {
        this.outputResponse = outputResponse;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public Map<String, String> getHeaders() {
        return headers == null ? Collections.emptyMap() : headers;
    }

    public void setHeaders(Map<String, String> headers) {
        this.headers = headers != null ? headers : new LinkedHashMap<>();
    }
}
