package com.oms.narrative;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oms.narrative.model.Log;
import com.oms.narrative.model.MathAuditFlag;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Math Auditor for OMS pricing logs: validates PRICING-CALCULATOR totals and parses 417 mismatch strings.
 */
public class OmsMathAuditor {

    public static final BigDecimal DEFAULT_VAT_RATE = new BigDecimal("0.15");
    private static final int SCALE = 4;
    private static final RoundingMode ROUND = RoundingMode.HALF_UP;

    private static final Pattern MISMATCH_PAIR =
            Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*!=\\s*(\\d+(?:\\.\\d+)?)");

    private final ObjectMapper objectMapper;

    public OmsMathAuditor() {
        this(new ObjectMapper());
    }

    public OmsMathAuditor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Full audit pass over all logs.
     *
     * @param logs    non-null list
     * @param vatRate e.g. {@code 0.15} for 15%; if null, {@link #DEFAULT_VAT_RATE} is used
     */
    public List<MathAuditFlag> audit(List<Log> logs, BigDecimal vatRate) {
        List<MathAuditFlag> flags = new ArrayList<>();
        if (logs == null || logs.isEmpty()) {
            return flags;
        }
        BigDecimal rate = vatRate != null ? vatRate : DEFAULT_VAT_RATE;

        for (Log log : logs) {
            if (log == null) {
                continue;
            }
            if (isPricingCalculator(log.getServiceName())) {
                flags.addAll(auditPricingCalculatorResponse(log, rate));
            }
            flags.addAll(auditFourSeventeenMismatch(log));
        }
        return flags;
    }

    private boolean isPricingCalculator(String serviceName) {
        if (serviceName == null) {
            return false;
        }
        return serviceName.trim().equalsIgnoreCase("PRICING-CALCULATOR");
    }

    private List<MathAuditFlag> auditPricingCalculatorResponse(Log log, BigDecimal vatRate) {
        List<MathAuditFlag> out = new ArrayList<>();
        String raw = log.getOutputResponse();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(raw);
        } catch (Exception e) {
            return out;
        }
        JsonNode products = findProductsArray(root);
        if (products == null || !products.isArray()) {
            return out;
        }

        int index = 0;
        for (JsonNode product : products) {
            if (product == null || product.isNull()) {
                index++;
                continue;
            }
            BigDecimal base = bd(product, "base", "basePrice", "baseAmount");
            BigDecimal tax = bd(product, "tax", "taxAmount");
            BigDecimal markup = bd(product, "markup", "markupAmount");
            BigDecimal discount = bd(product, "discount", "discountAmount", "discountTotal");

            if (base == null && tax == null && markup == null && discount == null) {
                index++;
                continue;
            }

            BigDecimal baseN = nz(base);
            BigDecimal taxN = nz(tax);
            BigDecimal markupN = nz(markup);
            BigDecimal discountN = nz(discount);

            BigDecimal expectedTotal = round4(baseN.add(taxN).add(markupN).subtract(discountN));
            BigDecimal expectedVat = round4(expectedTotal.multiply(vatRate));
            BigDecimal expectedTotalWithVat = round4(expectedTotal.add(expectedVat));

            BigDecimal declaredTotal = bd(product, "total", "lineTotal", "subTotal");
            BigDecimal declaredTotalWithVat = bd(product, "totalWithVat", "totalWithVAT", "grandTotal");

            if (declaredTotal != null) {
                BigDecimal diff = round4(declaredTotal.subtract(expectedTotal));
                if (diff.compareTo(BigDecimal.ZERO) != 0) {
                    out.add(new MathAuditFlag(
                            MathAuditFlag.FlagType.PRICING_LINE_MISMATCH,
                            log.getServiceName(),
                            log.getRequestURI(),
                            log.getTimestamp(),
                            String.format(
                                    "Product[%d] total mismatch: Expected %s, Found %s (diff %s)",
                                    index,
                                    expectedTotal.toPlainString(),
                                    round4(declaredTotal).toPlainString(),
                                    diff.toPlainString()),
                            expectedTotal,
                            round4(declaredTotal),
                            diff));
                }
            }

            BigDecimal declaredVat = bd(product, "vat", "vatAmount", "taxVat");
            if (declaredVat != null) {
                BigDecimal vatDiff = round4(declaredVat.subtract(expectedVat));
                if (vatDiff.compareTo(BigDecimal.ZERO) != 0) {
                    out.add(new MathAuditFlag(
                            MathAuditFlag.FlagType.PRICING_VAT_MISMATCH,
                            log.getServiceName(),
                            log.getRequestURI(),
                            log.getTimestamp(),
                            String.format(
                                    "VAT mismatch: Expected %s, Found %s (diff %s)",
                                    expectedVat.toPlainString(),
                                    round4(declaredVat).toPlainString(),
                                    vatDiff.toPlainString()),
                            expectedVat,
                            round4(declaredVat),
                            vatDiff));
                }
            }

            if (declaredTotalWithVat != null) {
                BigDecimal twDiff = round4(declaredTotalWithVat.subtract(expectedTotalWithVat));
                if (twDiff.compareTo(BigDecimal.ZERO) != 0) {
                    out.add(new MathAuditFlag(
                            MathAuditFlag.FlagType.PRICING_TOTAL_WITH_VAT_MISMATCH,
                            log.getServiceName(),
                            log.getRequestURI(),
                            log.getTimestamp(),
                            String.format(
                                    "totalWithVat mismatch: Expected %s, Found %s (diff %s)",
                                    expectedTotalWithVat.toPlainString(),
                                    round4(declaredTotalWithVat).toPlainString(),
                                    twDiff.toPlainString()),
                            expectedTotalWithVat,
                            round4(declaredTotalWithVat),
                            twDiff));
                }
            }
            index++;
        }
        return out;
    }

    /**
     * Looks for {@code products} at root or under common wrappers (data, result, payload, pricing).
     */
    private JsonNode findProductsArray(JsonNode root) {
        if (root == null || root.isNull()) {
            return null;
        }
        JsonNode direct = root.get("products");
        if (direct != null && direct.isArray()) {
            return direct;
        }
        String[] paths = {"data", "result", "payload", "pricing", "pricingResult", "response"};
        for (String p : paths) {
            JsonNode child = root.get(p);
            if (child != null && child.isObject()) {
                JsonNode arr = child.get("products");
                if (arr != null && arr.isArray()) {
                    return arr;
                }
            }
        }
        return null;
    }

    private List<MathAuditFlag> auditFourSeventeenMismatch(Log log) {
        List<MathAuditFlag> out = new ArrayList<>();
        String raw = log.getOutputResponse();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        String text = raw;
        boolean looks417 =
                text.contains("417")
                        || text.contains("HttpClientErrorException")
                        || text.toLowerCase().contains("expectation failed");
        if (!looks417) {
            return out;
        }
        Matcher m = MISMATCH_PAIR.matcher(text);
        while (m.find()) {
            BigDecimal left = new BigDecimal(m.group(1));
            BigDecimal right = new BigDecimal(m.group(2));
            BigDecimal diff = round4(left.subtract(right));
            out.add(new MathAuditFlag(
                    MathAuditFlag.FlagType.HTTP_417_MISMATCH_STRING,
                    log.getServiceName(),
                    log.getRequestURI(),
                    log.getTimestamp(),
                    String.format("417 mismatch: %s != %s (diff %s)", m.group(1), m.group(2), diff.toPlainString()),
                    left,
                    right,
                    diff));
        }
        return out;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static BigDecimal round4(BigDecimal v) {
        if (v == null) {
            return null;
        }
        return v.setScale(SCALE, ROUND);
    }

    private static BigDecimal bd(JsonNode node, String... fieldNames) {
        if (node == null || fieldNames == null) {
            return null;
        }
        for (String name : fieldNames) {
            if (name == null) {
                continue;
            }
            JsonNode v = node.get(name);
            if (v == null || v.isNull()) {
                continue;
            }
            if (v.isNumber()) {
                return round4(v.decimalValue());
            }
            if (v.isTextual()) {
                try {
                    return round4(new BigDecimal(v.asText().trim()));
                } catch (NumberFormatException ignored) {
                    // try next alias
                }
            }
        }
        return null;
    }
}
