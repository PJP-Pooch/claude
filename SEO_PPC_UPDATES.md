# SEO/PPC Opportunity Finder Updates

## Changes Made

### 1. SEO Focus Filter - STRICT PPC Click Requirement ✅

**Issue**: SEO Focus was showing for queries with ZERO PPC clicks if they were in "striking distance" (Position 11-20), or requiring >1 click.

**Solution**:
1. **Refined Priority 7 Rule**: Changed classification for "Striking Distance" queries (Pos 11-20) with no paid data from `'SEO Focus'` to `'No Action'`.
   - **Result**: `SEO Focus` strictly requires at least 1 PPC click (or conversion).
   - "Striking Distance" queries with no paid data are now labeled **No Action** (unflagged) instead of "Monitor" or "SEO Focus".

2. **Updated Minimum Click Threhold**: ensure queries with exactly 1 PPC click are included (changed `> 1` to `>= 1`).

**Files Modified**:
- `lib/opportunity-utils.ts`
  - Lines 154-158: Changed Striking Distance classification
  - Lines 230+: Added specific reason for Striking Distance under 'Monitor'

**Impact**: 
- **Zero Click Queries**: Queries with 0 PPC clicks will NO LONGER appear in "SEO Focus".
- **Minimal Activity Queries**: Queries with exactly 1 click WILL now appear in "SEO Focus".

---

### 2. New 'No Action' Category ✅

**Issue**: Default fallback was `'Monitor'`, suggesting active tracking even for irrelevant queries.

**Solution**: 
- Introduced a specific `'No Action'` category.
- Queries that don't trigger any specific opportunity flag now return `'No Action'` (displayed in light gray).
- Queries where organic performance is already good (Pos 1-10) with no paid spend still return `'Monitor'`.

**Impact**: Cleaner dashboard with clear distinction between "Good state" (Monitor) and "Nothing to report" (No Action).

---

### 3. Impression Share Data - Using Keyword Report & Fallbacks ✅

**Issue**: Impression share wasn't being filled out even though the CSV upload contained relevant columns.

**Solution**: 
1. **Keyword Report Support**: Added support for `Search impression share` (from Keyword Report).
2. **Fallback Logic**: Implemented fallback to use Top Impression columns (`Impr. (Top) %`) when main columns are missing.

**Files Modified**:
- `app/tools/seo-ppc-opportunities/page.tsx`
  - Added multi-column detection for Impression Share

---

## How to Export Data

### ⭐ Recommended: Keyword Report
Use the **Keyword report** for the best data (includes "Search impression share").
- **Columns**: `Keyword`, `Search impression share`, `Clicks`, `Cost`, `Conversions`

### Alternative: Search Terms Report
If using Search Terms report:
- **Columns**: `Search term`, `Search Impr. share` OR `Impr. (Top) %`

The tool automatically detects the correct columns.
