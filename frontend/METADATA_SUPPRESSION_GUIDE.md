# Signature Metadata Text Suppression Guide

## 🚨 CRITICAL ISSUE: Unwanted Signature Text

The document currently shows unwanted signature metadata text:

```
Jesal Shah <jesalshah234@gmail.com> signed at 2025-10-13T07:56:30.118Z
```

**This text should NOT appear in the document. Users want ONLY their signature image, no additional text.**

## What Users Expect vs What They're Getting

### ❌ Current (Wrong)
```
[Signature Image]
Jesal Shah <jesalshah234@gmail.com> signed at 2025-10-13T07:56:30.118Z
```

### ✅ Expected (Correct)
```
[Signature Image Only]
```

## Frontend Parameters Being Sent

The frontend is sending **multiple explicit flags** to suppress this text:

### URL Parameters
```
?notext=true&imageonly=true&clean=true
```

### Request Body Parameters
```javascript
{
  // Direct suppression flags
  "hideSignatureText": true,
  "hideSignerInfo": true, 
  "hideTimestamp": true,
  "noSignatureText": true,
  "imageOnly": true,
  "showText": false,
  "includeMetadata": false,
  
  // Config object
  "config": {
    "signatureOnly": true,
    "hideText": true,
    "noMetadata": true
  },
  
  // Clear instruction
  "instruction": "SIGNATURE_IMAGE_ONLY_NO_TEXT_NO_INFO"
}
```

## Required Backend Implementation

### Check for ANY of These Conditions
```javascript
app.post('/sign/:link', (req, res) => {
  const { 
    hideSignatureText,
    hideSignerInfo,
    imageOnly,
    showText,
    includeMetadata,
    config
  } = req.body;
  
  const { notext, imageonly } = req.query;
  
  // Check if signature text should be suppressed
  const suppressText = (
    hideSignatureText === true ||
    hideSignerInfo === true ||
    imageOnly === true ||
    showText === false ||
    includeMetadata === false ||
    config?.signatureOnly === true ||
    config?.hideText === true ||
    notext === 'true' ||
    imageonly === 'true'
  );
  
  if (suppressText) {
    // ONLY place the signature image
    // DO NOT add any text like "Name <email> signed at timestamp"
    placeSignatureImageOnly(signature, placement);
  } else {
    // Legacy mode with text (if needed)
    placeSignatureWithMetadata(signature, placement, signerInfo);
  }
});
```

### Example Implementation Functions

```javascript
// CORRECT - Image only
function placeSignatureImageOnly(signatureImage, placement) {
  // Convert base64 to image
  const image = base64ToImage(signatureImage);
  
  // Place ONLY the image at coordinates
  pdf.addImage(
    image,
    placement.pageNumber,
    placement.x,
    placement.y,
    placement.width,
    placement.height
  );
  
  // DO NOT add any text
  // DO NOT call addSignatureText()
  // DO NOT call addTimestamp()
  // DO NOT call addSignerInfo()
}

// INCORRECT - Adds unwanted text
function placeSignatureWithMetadata(signatureImage, placement, signerInfo) {
  // Place image
  placeSignatureImageOnly(signatureImage, placement);
  
  // Add text (THIS IS WHAT WE DON'T WANT)
  pdf.addText(
    `${signerInfo.name} <${signerInfo.email}> signed at ${timestamp}`,
    placement.pageNumber,
    placement.x,
    placement.y + placement.height + 0.01
  );
}
```

## Testing the Fix

After implementing the backend changes:

1. ✅ **Sign document** - Place signature on document
2. ✅ **Download PDF** - Check the signed document
3. ✅ **Verify result** - Should show ONLY signature image
4. ❌ **No text** - Should NOT show "Name <email> signed at..."

## Debug Console Output

The frontend console shows:
```
🚫 METADATA SUPPRESSION FLAGS:
hideSignatureText: true
hideSignerInfo: true
imageOnly: true
showText: false
📝 URL params: ?single=true&clean=true&user=true&notext=true&imageonly=true
📋 Instruction: SIGNATURE_IMAGE_ONLY_NO_TEXT_NO_INFO
```

Add similar logging in your backend:
```javascript
console.log('🚫 METADATA SUPPRESSION CHECK:');
console.log('hideSignatureText:', req.body.hideSignatureText);
console.log('imageOnly:', req.body.imageOnly);
console.log('notext param:', req.query.notext);
console.log('Should suppress text:', suppressText);
```

## Common Backend Mistakes

### ❌ Don't Do This
```javascript
// This adds unwanted text
function signDocument(signature, placement, signerInfo) {
  placeSignature(signature, placement);
  
  // THIS IS THE PROBLEM - removes this
  addSignatureText(`${signerInfo.name} <${signerInfo.email}> signed at ${new Date()}`);
}
```

### ✅ Do This Instead
```javascript
function signDocument(signature, placement, signerInfo, options) {
  placeSignature(signature, placement);
  
  // Only add text if explicitly requested
  if (!options.suppressText && !options.imageOnly) {
    addSignatureText(`${signerInfo.name} <${signerInfo.email}> signed at ${new Date()}`);
  }
}
```

## Priority: CRITICAL

This directly affects user experience. Users are confused and frustrated when they see text they didn't add to their document. The signature should be clean and professional, showing only what the user drew.

**Please implement the metadata suppression checks immediately.**