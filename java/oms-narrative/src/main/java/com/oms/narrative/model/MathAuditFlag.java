package com.oms.narrative.model;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * A single pricing / mismatch finding from {@link com.oms.narrative.OmsMathAuditor}.
 */
public class MathAuditFlag {

    public enum FlagType {
        PRICING_LINE_MISMATCH,
        PRICING_VAT_MISMATCH,
        PRICING_TOTAL_WITH_VAT_MISMATCH,
        HTTP_417_MISMATCH_STRING
    }

    private final FlagType type;
    private final String serviceName;
    private final String requestURI;
    private final String timestamp;
    /** Human-readable message including expected/found/delta where applicable. */
    private final String message;
    private final BigDecimal expected;
    private final BigDecimal found;
    private final BigDecimal difference;

    public MathAuditFlag(
            FlagType type,
            String serviceName,
            String requestURI,
            String timestamp,
            String message,
            BigDecimal expected,
            BigDecimal found,
            BigDecimal difference) {
        this.type = Objects.requireNonNull(type);
        this.serviceName = serviceName;
        this.requestURI = requestURI;
        this.timestamp = timestamp;
        this.message = message;
        this.expected = expected;
        this.found = found;
        this.difference = difference;
    }

    public FlagType getType() {
        return type;
    }

    public String getServiceName() {
        return serviceName;
    }

    public String getRequestURI() {
        return requestURI;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public String getMessage() {
        return message;
    }

    public BigDecimal getExpected() {
        return expected;
    }

    public BigDecimal getFound() {
        return found;
    }

    public BigDecimal getDifference() {
        return difference;
    }
}
