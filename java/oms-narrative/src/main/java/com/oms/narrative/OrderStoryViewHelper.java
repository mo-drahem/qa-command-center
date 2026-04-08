package com.oms.narrative;

import com.oms.narrative.model.HeaderSummary;
import com.oms.narrative.model.MathAuditFlag;
import com.oms.narrative.model.StoryEvent;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Formats {@link StoryEvent} lists for UI layers (HTML snippets or plain text).
 * Use HTML branch when your front-end can render safe HTML; escape user-controlled strings in production.
 */
public class OrderStoryViewHelper {

    private OrderStoryViewHelper() {
    }

    public static String formatHeaderSummaryHtml(HeaderSummary header) {
        if (header == null) {
            return "";
        }
        String email = esc(header.getUserEmail());
        String cur = esc(header.getCurrency());
        return "<div class=\"oms-story-header\"><strong>User:</strong> "
                + (email != null ? email : "—")
                + " &nbsp;|&nbsp; <strong>Currency:</strong> "
                + (cur != null ? cur : "—")
                + "</div>";
    }

    /**
     * Full story block: header + timeline. Math flags render as bold red lines per event.
     */
    public static String formatStoryTimelineHtml(HeaderSummary header, List<StoryEvent> events) {
        StringBuilder sb = new StringBuilder();
        sb.append(formatHeaderSummaryHtml(header));
        sb.append("<ol class=\"oms-story-timeline\" style=\"margin-top:1rem;\">");
        if (events != null) {
            for (StoryEvent e : events) {
                if (e == null) {
                    continue;
                }
                sb.append("<li style=\"margin-bottom:0.75rem;\">");
                if (e.getEmphasis() == StoryEvent.DisplayEmphasis.SLOW) {
                    sb.append("<span style=\"color:#92400e;font-weight:600;\">");
                    sb.append(esc(e.getNarrativeLine()));
                    sb.append("</span>");
                } else {
                    sb.append(esc(e.getNarrativeLine()));
                }
                for (MathAuditFlag f : e.getMathFlags()) {
                    sb.append("<div style=\"color:#b91c1c;font-weight:700;margin-top:0.35rem;\">");
                    sb.append(esc(f.getMessage()));
                    sb.append("</div>");
                }
                sb.append("</li>");
            }
        }
        sb.append("</ol>");
        return sb.toString();
    }

    /**
     * Plain text fallback for logs / email (no HTML).
     */
    public static List<String> formatStoryLinesPlain(HeaderSummary header, List<StoryEvent> events) {
        List<String> lines = new ArrayList<>();
        if (header != null) {
            lines.add("User: " + Objects.toString(header.getUserEmail(), "—")
                    + " | Currency: " + Objects.toString(header.getCurrency(), "—"));
        }
        if (events != null) {
            for (StoryEvent e : events) {
                if (e == null) {
                    continue;
                }
                lines.add("* " + Objects.toString(e.getNarrativeLine(), ""));
                for (MathAuditFlag f : e.getMathFlags()) {
                    lines.add("  ** MATH: " + Objects.toString(f.getMessage(), "") + " **");
                }
            }
        }
        return lines;
    }

    private static String esc(String s) {
        if (s == null) {
            return null;
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
