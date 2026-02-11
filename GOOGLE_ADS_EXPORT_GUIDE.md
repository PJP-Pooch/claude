# Google Ads CSV Export Guide for SEO/PPC Opportunity Finder

## ⭐ RECOMMENDED: Use Keyword Report

The **Keyword report** provides the best data for this tool, especially for impression share metrics.

### How to Export Keyword Report from Google Ads:

1. Go to **Campaigns** → **Keywords** → **Search keywords**
2. Click the **Download** icon
3. Select **Download as CSV**
4. Make sure these columns are included:
   - ✅ **Keyword** (required - the query/term)
   - ✅ **Clicks**
   - ✅ **Impressions** (or "Impr.")
   - ✅ **Cost**
   - ✅ **Conversions**
   - ✅ **Conv. value** (or "Total conv. value")
   - ✅ **Campaign**
   - ✅ **Ad group**
   - ✅ **Match type**
   - ✅ **Search impression share** ⭐ (This is the key column!)
   - ✅ **Search lost IS (budget)** (optional but recommended)
   - ✅ **Search lost IS (rank)** (optional but recommended)

### Why Keyword Report is Better:

| Feature | Keyword Report | Search Terms Report |
|---------|---------------|---------------------|
| **Impression Share Column** | ✅ "Search impression share" | ⚠️ Often missing or limited |
| **Data Completeness** | ✅ Complete for all keywords | ⚠️ May have gaps |
| **Match Type Data** | ✅ Shows actual match type | ✅ Shows actual match type |
| **Historical Data** | ✅ Full history | ⚠️ Limited (Google removes old search terms) |

---

## Alternative: Search Terms Report

If you prefer to use Search Terms report:

### How to Export Search Terms Report:

1. Go to **Campaigns** → **Insights and reports** → **Search terms**
2. Click the **Download** icon
3. Select **Download as CSV**
4. Include these columns:
   - ✅ **Search term** (required)
   - ✅ **Clicks**
   - ✅ **Impr.** (Impressions)
   - ✅ **Cost**
   - ✅ **Conversions**
   - ✅ **Conv. value**
   - ✅ **Campaign**
   - ✅ **Ad group**
   - ✅ **Match type**
   - ⚠️ **Search Impr. share** (if available)
   - ⚠️ **Impr. (Top) %** (fallback if Search Impr. share not available)
   - ⚠️ **Impr. (Abs. Top) %** (fallback if Search Impr. share not available)

---

## Supported Column Names

The tool automatically detects these column name variations:

### Query/Term Column:
- `Search term`
- `Search keyword`
- `Keyword` ⭐ (Keyword report)

### Impression Share Column:
- `Search Impr. share`
- `Impr. share`
- `Search impression share` ⭐ (Keyword report - BEST)
- `Impr. (Top) %` (fallback)
- `Impr. (Abs. Top) %` (fallback)

### Other Columns:
- Clicks: `Clicks`, `clicks`
- Impressions: `Impr.`, `Impressions`, `impressions`
- Cost: `Cost`, `cost`
- Conversions: `Conversions`, `conversions`
- Conv. Value: `Conv. value`, `Total conv. value`, `conversion_value`
- Campaign: `Campaign`
- Ad Group: `Ad group`
- Match Type: `Match type`

---

## Quick Comparison

| Report Type | Best For | Impression Share |
|-------------|----------|------------------|
| **Keyword Report** ⭐ | Complete keyword analysis | ✅ Excellent |
| **Search Terms Report** | Actual search queries | ⚠️ Limited/Missing |

## Recommendation

**Use the Keyword Report** for the most complete data, especially if you want accurate impression share metrics for scaling opportunities and budget optimization insights.
