package com.oms.narrative;

import com.oms.narrative.model.HeaderSummary;
import com.oms.narrative.model.Log;
import com.oms.narrative.model.MathAuditFlag;
import com.oms.narrative.model.StoryEvent;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Builds high-level business story events from raw logs and {@link OmsMathAuditor} output.
 */
public class OrderStoryGenerator {

    private static final long SLOW_MS = 500L;

    private final OmsMathAuditor mathAuditor;

    public OrderStoryGenerator() {
        this(new OmsMathAuditor());
    }

    public OrderStoryGenerator(OmsMathAuditor mathAuditor) {
        this.mathAuditor = Objects.requireNonNull(mathAuditor);
    }

    /**
     * @param logs    preserve list order for the story timeline
     * @param vatRate pass through to auditor; null uses default 15%
     */
    public List<StoryEvent> generateOrderStory(List<Log> logs, BigDecimal vatRate) {
        if (logs == null) {
            return Collections.emptyList();
        }
        List<MathAuditFlag> flags = mathAuditor.audit(logs, vatRate);
        Map<String, List<MathAuditFlag>> flagsByKey = indexFlags(flags);

        List<StoryEvent> events = new ArrayList<>();
        for (Log log : logs) {
            if (log == null) {
                continue;
            }
            StoryEvent e = new StoryEvent();
            e.setTimestamp(log.getTimestamp());
            e.setServiceName(log.getServiceName());
            e.setRequestURI(log.getRequestURI());
            e.setDurationMs(log.getDurationMs());

            String uri = log.getRequestURI() != null ? log.getRequestURI() : "";
            String action = mapUriToBusinessAction(uri);
            e.setBusinessAction(action);

            boolean slow = log.getDurationMs() != null && log.getDurationMs() > SLOW_MS;
            e.setSlowResponse(slow);

            StringBuilder line = new StringBuilder();
            if (log.getTimestamp() != null) {
                line.append("[").append(log.getTimestamp()).append("] ");
            }
            line.append(action);
            if (log.getServiceName() != null) {
                line.append(" — ").append(log.getServiceName());
            }
            if (slow) {
                line.append(" (Slow Response)");
            }
            e.setNarrativeLine(line.toString());

            String key = correlationKey(log);
            for (MathAuditFlag f : flagsByKey.getOrDefault(key, Collections.emptyList())) {
                e.addMathFlag(f);
            }

            if (!e.getMathFlags().isEmpty()) {
                e.setEmphasis(StoryEvent.DisplayEmphasis.MATH_ALERT);
            } else if (slow) {
                e.setEmphasis(StoryEvent.DisplayEmphasis.SLOW);
            } else {
                e.setEmphasis(StoryEvent.DisplayEmphasis.NORMAL);
            }

            events.add(e);
        }
        return events;
    }

    private static String correlationKey(Log log) {
        String ts = log.getTimestamp() == null ? "" : log.getTimestamp().trim();
        if (!ts.isEmpty()) {
            return "ts:" + ts + "|uri:" + nullSafe(log.getRequestURI()) + "|svc:" + nullSafe(log.getServiceName());
        }
        return "uri:" + nullSafe(log.getRequestURI()) + "|svc:" + nullSafe(log.getServiceName());
    }

    private static String correlationKey(MathAuditFlag f) {
        String ts = f.getTimestamp() == null ? "" : f.getTimestamp().trim();
        if (!ts.isEmpty()) {
            return "ts:" + ts + "|uri:" + nullSafe(f.getRequestURI()) + "|svc:" + nullSafe(f.getServiceName());
        }
        return "uri:" + nullSafe(f.getRequestURI()) + "|svc:" + nullSafe(f.getServiceName());
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private Map<String, List<MathAuditFlag>> indexFlags(List<MathAuditFlag> flags) {
        Map<String, List<MathAuditFlag>> map = new LinkedHashMap<>();
        if (flags == null) {
            return map;
        }
        for (MathAuditFlag f : flags) {
            map.computeIfAbsent(correlationKey(f), ignored -> new ArrayList<>()).add(f);
        }
        return map;
    }

    public HeaderSummary extractHeaderSummary(List<Log> logs) {
        HeaderSummary h = new HeaderSummary();
        if (logs == null || logs.isEmpty()) {
            return h;
        }
        Log first = logs.get(0);
        if (first == null || first.getHeaders() == null) {
            return h;
        }
        Map<String, String> norm = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : first.getHeaders().entrySet()) {
            if (e.getKey() != null) {
                norm.put(e.getKey().toLowerCase(Locale.ROOT), e.getValue());
            }
        }
        h.setUserEmail(firstNonBlank(
                norm.get("x-user-email"),
                norm.get("user-email"),
                norm.get("email"),
                norm.get("x-email")));
        h.setCurrency(firstNonBlank(
                norm.get("currency"),
                norm.get("x-currency"),
                norm.get("x-curr"),
                norm.get("accept-currency")));
        return h;
    }

    private static String firstNonBlank(String... vals) {
        if (vals == null) {
            return null;
        }
        for (String v : vals) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    static String mapUriToBusinessAction(String uri) {
        if (uri == null || uri.isBlank()) {
            return "API Call";
        }
        String u = uri;
        if (u.contains("/cart/") && u.contains("/prepare")) {
            return "Checkout Initiated";
        }
        if (u.contains("/apply/on-cart")) {
            return "Pricing & Discounts Applied";
        }
        if (u.contains("/max-usage/")) {
            return "Promotion Limit Validation";
        }
        return "API Call";
    }
}
