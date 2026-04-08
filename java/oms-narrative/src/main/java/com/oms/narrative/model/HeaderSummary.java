package com.oms.narrative.model;

/**
 * Snapshot from the first log's headers for the story header row.
 */
public class HeaderSummary {

    private String userEmail;
    private String currency;

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}
