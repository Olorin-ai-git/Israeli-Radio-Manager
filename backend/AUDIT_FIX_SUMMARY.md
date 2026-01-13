# Audit Report Issues - Fixed

## Problems Found in Audit Report

### 1. ❌ **Negative Healthy Items** (-186)
**Problem:** `healthy_items = total_items - total_issues` was subtracting the TOTAL issue count from items, but one item can have multiple issues.

**Example:**
- 187 items total
- 186 have broken streams
- 187 have missing metadata
- Total issues = 373 (but these are the SAME 186 items with 2 issues each!)
- Old calculation: 187 - 373 = **-186** ❌

**Fix:** Now counts unique items with issues:
```python
items_with_issues = set()  # Track unique items
for stream in broken_streams:
    items_with_issues.add(stream.content_id)
for meta in missing_metadata:
    items_with_issues.add(meta.content_id)

healthy_items = total_items - len(items_with_issues)
```

**Result:** healthy_items = 187 - 186 = **1** ✅

---

### 2. ❌ **Metadata Extraction Shows "SUCCESS" When All Failed**
**Problem:** Log showed `✅ Extracted metadata for 0 items, 186 failed` with SUCCESS level

**Fix:** Now uses appropriate log levels:
- **ERROR** - All items failed (0 success, 186 failed)
- **WARN** - Partial success (some failures)
- **SUCCESS** - All or most succeeded

**New Output:**
```
❌ Metadata extraction failed for all 186 items - check file accessibility and format
```

---

### 3. ❌ **HTTP 403 Errors on Converted URLs**
**Problem:** GCS URLs were converted to public HTTPS URLs:
```
gs://bucket/file.mp3 → https://storage.googleapis.com/bucket/file.mp3
```

But the bucket is **not public**, so all requests returned **403 Forbidden**.

**Root Cause:**
- `get_public_url()` always returns a URL (doesn't check if bucket is public)
- Fallback to `get_signed_url()` never happened because public URL was "successful"
- Public URLs only work if bucket has `allUsers:objectViewer` permission

**Fix:** Use **signed URLs** by default (valid for 24 hours):
```python
# Use signed URLs (they work regardless of bucket permissions)
https_url = gcs_service.get_signed_url(gcs_path)

# Fallback to public only if signed fails
if not https_url:
    https_url = gcs_service.get_public_url(gcs_path)
```

**Result:** URLs will now be signed and accessible ✅

---

### 4. ❌ **Issues Fixed Count Wrong**
**Problem:** Report showed "Issues Fixed: 373" but only 186 URLs were actually fixed.

**What Happened:**
- Fixed 186 URLs ✅
- Tried to extract metadata for 186 items
- Metadata extraction failed for all 186 items ❌
- Total fixes = 186 (not 373)

**Fix:** `issues_fixed` now correctly counts only successful actions from `librarian_actions` collection.

---

## Expected Results After Fixes

### Before:
```
Total Items: 187
Issues Found: 373
Issues Fixed: 373  ❌ (wrong - metadata failed)
Healthy Items: -186  ❌ (impossible!)
```

### After (Next Audit):
```
Total Items: 187
Issues Found: 373 (186 broken streams + 187 missing metadata)
Issues Fixed: 186 (URLs converted to signed URLs)
Healthy Items: 1 ✅ (187 - 186 unique items with issues)
Unique Items with Issues: 186
```

---

## Why Metadata Extraction Failed

**Reason:** The URLs were converted to **public HTTPS URLs** that returned **403 Forbidden**.

The metadata extractor tried to:
1. Download the file via HTTP
2. Extract duration using `audioread`

But every request failed with 403 because:
- Bucket is not public
- Public URLs don't work
- Signed URLs were not used

**Solution:** With signed URLs, metadata extraction should now work!

---

## Next Steps

### 1. Run Another Audit (LIVE mode)

This will:
- ✅ Convert remaining URLs to **signed URLs** (not public)
- ✅ Successfully extract metadata (URLs now accessible)
- ✅ Show correct "Healthy Items" count
- ✅ Use proper log levels for failures

### 2. Optional: Make Bucket Public

If you want to use public URLs instead of signed URLs:

```bash
# Make bucket public
gsutil iam ch allUsers:objectViewer gs://israeli-radio-475c9-audio

# Verify
gsutil iam get gs://israeli-radio-475c9-audio
```

**Then edit `/backend/app/services/auto_fixer.py`** to use public URLs first again.

### 3. Verify Streams Work

After next audit:
- Check Library page
- Click play on any item
- Should stream successfully with new signed URLs

---

## Files Modified

1. **`/backend/app/services/librarian_service.py`**
   - Fixed healthy_items calculation to count unique items
   - Added `unique_items_with_issues` to summary

2. **`/backend/app/services/auto_fixer.py`**
   - Changed to use signed URLs by default
   - Fixed metadata extraction log levels
   - Better error messages

---

**Status:** ✅ All issues fixed, ready for next audit
**Date:** January 13, 2026
