# Backend Integration - Duplicate Signature Prevention

## 🚨 URGENT: Duplicate Signatures & Metadata Text Issue

The frontend is sending comprehensive parameters to prevent duplicate signatures and metadata text, but the backend is not respecting them. **Multiple issues in the final document:**

1. ✅ User's signature at the specified location (correct)
2. ❌ Additional signature at the bottom of the document (unwanted)
3. ❌ Signature metadata text: "Jesal Shah <jesalshah234@gmail.com> signed at 2025-10-13T07:56:30.118Z" (unwanted)

## Frontend Parameters Being Sent

The frontend now sends these parameters in the signing request:

### URL Parameters
```
POST /sign/{link}?single=true&clean=true&user=true&notext=true&imageonly=true
```

### Request Body Parameters
```javascript
{
  "signature": "data:image/png;base64,...",
  "consent": true,
  "placement": {
    "pageNumber": 1,
    "x": 0.5,
    "y": 0.3,
    "width": 0.25,
    "height": 0.08
  },
  
  // DUPLICATE PREVENTION FLAGS
  "preventDuplicatePlacement": true,
  "singleSignatureMode": true,
  "cleanSignatureOnly": true,
  "onlyUserPlacement": true,
  "noDefaultSignature": true,
  "customPlacementOnly": true,
  "disableAutoSignature": false,
  "placementMode": "user_only",
  "signatureCount": 1,
  
  // METADATA SUPPRESSION FLAGS
  "hideSignatureText": true,
  "hideSignerInfo": true,
  "hideTimestamp": true,
  "noSignatureText": true,
  "imageOnly": true,
  "showText": false,
  "includeMetadata": false,
  
  "config": {
    "singleSignature": true,
    "userPlacementOnly": true,
    "noMetadata": true,
    "signatureOnly": true,
    "hideText": true
  },
  
  "instruction": "SIGNATURE_IMAGE_ONLY_NO_TEXT_NO_INFO"
}
```

## Required Backend Changes

### 1. Check for Single Signature Mode
```javascript
// In your signing endpoint
app.post('/sign/:link', (req, res) => {
  const { 
    signature, 
    placement, 
    singleSignatureMode,
    preventDuplicatePlacement,
    cleanSignatureOnly,
    config
  } = req.body;
  
  // Check URL parameters
  const { single, clean, user } = req.query;
  
  // CRITICAL: Only place signature at user-specified location
  if (singleSignatureMode === true || 
      preventDuplicatePlacement === true || 
      single === 'true' ||
      config?.singleSignature === true) {
    
    // ONLY place signature at the placement coordinates
    placeSignatureAt(signature, placement);
    
    // DO NOT call any default signature placement functions
    // DO NOT add signatures at bottom or anywhere else
    
  } else {
    // Normal multi-signature mode (if needed)
    placeSignatureWithDefaults(signature, placement);
  }
});
```

### 2. Disable Automatic Signature Information
```javascript
if (cleanSignatureOnly === true || 
    config?.noMetadata === true || 
    hideSignatureText === true ||
    imageOnly === true ||
    showText === false ||
    clean === 'true' ||
    req.query.notext === 'true' ||
    req.query.imageonly === 'true') {
  
  // DO NOT add signature text like:
  // "Jesal Shah <jesalshah234@gmail.com> signed at 2025-10-13T07:56:30.118Z"
  
  // Only place the signature image itself - NO TEXT AT ALL
  placeSignatureImageOnly(signature, placement);
  
} else {
  // Legacy behavior with text (if needed)
  placeSignatureWithText(signature, placement, signerInfo, timestamp);
}
```

### 3. Example Implementation
```javascript
function processSigningRequest(req, res) {
  const { signature, placement, singleSignatureMode } = req.body;
  
  if (singleSignatureMode) {
    // ONLY place signature at specified coordinates
    const signedPdf = await placeSingleSignature(
      originalPdf,
      signature,
      placement.pageNumber,
      placement.x,
      placement.y,
      placement.width,
      placement.height
    );
    
    // DO NOT call addDefaultSignature() or similar functions
    
    return res.json({ success: true, signedPdf });
  }
}
```

## Debug Logging

The frontend console now shows:
```
🚨 DUPLICATE SIGNATURE PREVENTION FLAGS:
preventDuplicatePlacement: true
singleSignatureMode: true
cleanSignatureOnly: true
URL params: ?single=true&clean=true&user=true
```

Add similar logging in your backend:
```javascript
console.log('🚨 RECEIVED SIGNING REQUEST:');
console.log('singleSignatureMode:', req.body.singleSignatureMode);
console.log('preventDuplicatePlacement:', req.body.preventDuplicatePlacement);
console.log('URL single param:', req.query.single);
console.log('Placement:', req.body.placement);
```

## Testing

After implementing the backend changes:

1. ✅ **Sign document** with user placement
2. ✅ **Check PDF** should show ONLY user's signature at specified location
3. ❌ **No signature at bottom** or other locations
4. ❌ **No signature metadata text**

## Current vs Expected Behavior

### Current (Wrong) ❌
- User places signature at coordinates (0.5, 0.3) 
- Backend places signature at (0.5, 0.3) ✅
- Backend ALSO places signature at bottom (0.1, 0.1) ❌
- Result: **Two signatures in document** ❌

### Expected (Correct) ✅  
- User places signature at coordinates (0.5, 0.3)
- Backend places signature ONLY at (0.5, 0.3) ✅
- Backend does NOT place any other signatures ✅
- Result: **One signature in document** ✅

## Priority: HIGH

This issue affects document integrity and user experience. Users expect to see only the signature they placed, not additional signatures they didn't authorize.

**Please implement the parameter checks immediately to resolve the duplicate signature issue.**