package com.oms.narrative.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * One row in the Business Story timeline (narrative UI).
 */
public class StoryEvent {

    public enum DisplayEmphasis {
        NORMAL,
        SLOW,
        MATH_ALERT
    }

    private String timestamp;
    private String businessAction;
    private String serviceName;
    private String requestURI;
    private Long durationMs;
    private boolean slowResponse;
    private DisplayEmphasis emphasis = DisplayEmphasis.NORMAL;
    private String narrativeLine;
    private final List<MathAuditFlag> mathFlags = new ArrayList<>();

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getBusinessAction() {
        return businessAction;
    }

    public void setBusinessAction(String businessAction) {
        this.businessAction = businessAction;
    }

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

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }

    public boolean isSlowResponse() {
        return slowResponse;
    }

    public void setSlowResponse(boolean slowResponse) {
        this.slowResponse = slowResponse;
    }

    public DisplayEmphasis getEmphasis() {
        return emphasis;
    }

    public void setEmphasis(DisplayEmphasis emphasis) {
        this.emphasis = Objects.requireNonNullElse(emphasis, DisplayEmphasis.NORMAL);
    }

    public String getNarrativeLine() {
        return narrativeLine;
    }

    public void setNarrativeLine(String narrativeLine) {
        this.narrativeLine = narrativeLine;
    }

    public List<MathAuditFlag> getMathFlags() {
        return Collections.unmodifiableList(mathFlags);
    }

    public void addMathFlag(MathAuditFlag flag) {
        if (flag != null) {
            mathFlags.add(flag);
            this.emphasis = DisplayEmphasis.MATH_ALERT;
        }
    }
}
