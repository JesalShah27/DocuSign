# Signature Troubleshooting Guide

## Problem Description
The signed document shows:
1. ✅ User's signature at the specified location (correct)
2. ❌ Additional signature at the bottom of the document (unwanted)
3. ❌ Signature metadata text like "jesal Shah <jesalshah234@gmail.com> signed at 2025-10-13T06:14:48.796Z" (unwanted)

**Goal**: Only show the user's signature at the location they specified, with no additional signatures or metadata.

## Frontend Fixes Implemented

### 1. Signing Request Parameters
The frontend now sends comprehensive parameters to prevent duplicates:

```javascript
const signingPayload = {
  signature,
  consent,
  location: { latitude, longitude }, // optional
  
  // Explicit placement
  placement: {
    pageNumber: placement.pageNumber,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height
  },
  
  // Duplicate prevention flags
  preventDuplicatePlacement: true,
  useOnlySpecifiedPlacement: true,
  disableDefaultPlacement: true,
  singleSignatureMode: true,
  onlyUserPlacement: true,
  suppressDefaultSignature: true,
  
  // Metadata suppression flags
  disableSignatureInfo: true,
  disableSignatureText: true,
  disableTimestamp: true,
  disableSignerInfo: true,
  hideSignatureDetails: true,
  suppressMetadata: true,
  cleanSignatureOnly: true,
  
  // Signature style settings
  signatureStyle: {
    showTimestamp: false,
    showSignerName: false,
    showSignerEmail: false,
    showLocation: false,
    minimalist: true,
    signatureOnly: true
  },
  
  // Explicit instruction
  instructions: 'SINGLE_SIGNATURE_ONLY_AT_SPECIFIED_LOCATION_NO_ADDITIONAL_INFO'
}
```

### 2. Query Parameters
Added URL parameters for additional clarity:

```
/sign/{link}?singleSignature=true&noMetadata=true&cleanMode=true&onlyUserPlacement=true
```

Note: Custom headers were removed due to CORS restrictions.

### 3. Double-Click Prevention
- Button disabled during signing process
- Pointer events disabled when signing
- State checks prevent multiple attempts
- Unique request ID for each attempt

## Backend Requirements

**The backend needs to be updated to respect these parameters:**

### 1. Signature Placement Logic
```javascript
// Backend should check for these flags:
if (payload.useOnlySpecifiedPlacement || payload.singleSignatureMode) {
  // ONLY place signature at the specified location
  // DO NOT add default signature at bottom
  // DO NOT add signature in any other location
}

if (payload.suppressDefaultSignature || payload.disableDefaultPlacement) {
  // Completely disable any automatic signature placement
}
```

### 2. Metadata Suppression
```javascript
// Backend should check for these flags:
if (payload.disableSignatureInfo || payload.cleanSignatureOnly) {
  // DO NOT add signature information text
  // DO NOT add timestamp text
  // DO NOT add signer name/email text
}

if (payload.signatureStyle?.signatureOnly) {
  // Only render the actual signature image
  // No additional text or metadata
}
```

### 3. Query Parameter Handling
```javascript
// Backend should check URL parameters:
if (query.singleSignature === 'true') {
  // Only allow one signature placement
}

if (query.noMetadata === 'true') {
  // Suppress all signature metadata
}
```

## Testing Steps

1. **Sign a document** and place signature at a specific location
2. **Check the downloaded PDF** for:
   - ✅ Signature appears only at specified location
   - ❌ No additional signature at bottom
   - ❌ No signature metadata text
   - ❌ No timestamp information

## Console Debugging

The frontend now logs detailed information:

```
Starting signing process...
Sending signing request with placement: {pageNumber: 1, x: 0.5, y: 0.3, width: 0.25, height: 0.08}
Signing payload: {signature: "data:image...", consent: true, placement: {...}, preventDuplicatePlacement: true, ...}
Making POST request to sign endpoint...
Signing response received: 200 {...}
```

Check browser console for these logs to confirm the correct parameters are being sent.

## Backend Code Examples

### Signature Processing (Example)
```javascript
app.post('/sign/:link', (req, res) => {
  const { 
    signature, 
    placement, 
    preventDuplicatePlacement,
    singleSignatureMode,
    disableSignatureInfo,
    signatureStyle 
  } = req.body;
  
  // Only place signature at specified location
  if (singleSignatureMode || preventDuplicatePlacement) {
    // Place ONLY at placement coordinates
    placeSignatureAt(signature, placement);
    
    // Do NOT call any default signature placement functions
    // Do NOT add signatures at bottom or other locations
  }
  
  // Suppress metadata if requested
  if (disableSignatureInfo || signatureStyle?.signatureOnly) {
    // Do NOT add signature text/timestamp/metadata
  }
  
  res.json({ success: true });
});
```

## Immediate Action Required

**The backend must be updated** to respect the new parameters being sent by the frontend. Until the backend is updated, the duplicate signatures and metadata will continue to appear regardless of frontend changes.

### Key Backend Changes Needed:
1. ✅ **Check for `singleSignatureMode` parameter** - only place one signature
2. ✅ **Check for `disableSignatureInfo` parameter** - suppress metadata text  
3. ✅ **Respect `placement` coordinates** - don't add default placements
4. ✅ **Check query parameters** for additional flags

Once the backend implements these checks, the signed documents will show only the user's signature at their specified location with no additional information.