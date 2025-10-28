# Backend Test Endpoint to Debug Parameters

## Create This Test Endpoint

Add this temporary endpoint to see exactly what parameters the frontend is sending:

```javascript
// Add this to your backend routes (TEMPORARY - for debugging only)
app.post('/sign/:link/debug', (req, res) => {
  console.log('\n🔍 FRONTEND SIGNING PARAMETERS DEBUG:');
  console.log('URL Parameters:', req.query);
  console.log('Body Parameters:', JSON.stringify(req.body, null, 2));
  
  // Find all parameters related to text suppression
  const textParams = {};
  
  // Check URL params
  Object.keys(req.query).forEach(key => {
    if (key.toLowerCase().includes('text') || 
        key.toLowerCase().includes('hide') ||
        key.toLowerCase().includes('suppress') ||
        key.toLowerCase().includes('clean') ||
        key.toLowerCase().includes('image')) {
      textParams[`query_${key}`] = req.query[key];
    }
  });
  
  // Check body params  
  Object.keys(req.body).forEach(key => {
    if (key.toLowerCase().includes('text') || 
        key.toLowerCase().includes('hide') ||
        key.toLowerCase().includes('suppress') ||
        key.toLowerCase().includes('clean') ||
        key.toLowerCase().includes('image')) {
      textParams[`body_${key}`] = req.body[key];
    }
  });
  
  console.log('\n📋 TEXT SUPPRESSION PARAMETERS FOUND:');
  console.log(textParams);
  
  console.log('\n🎯 THESE PARAMETERS MEAN: DO NOT ADD TEXT TO PDF');
  console.log('Current backend behavior: STILL ADDS TEXT (this is the bug)');
  console.log('Required fix: Check these parameters and suppress text when true\n');
  
  res.json({
    message: 'Debug info logged to console',
    textSuppressionParams: textParams,
    allParams: {
      query: req.query,
      body: req.body
    }
  });
});
```

## How to Test

1. **Add the debug endpoint** to your backend
2. **Change the frontend URL** temporarily from `/sign/{link}` to `/sign/{link}/debug`
3. **Try signing** a document
4. **Check backend console** - you'll see all the parameters the frontend is sending
5. **Look for text suppression parameters** - there should be many with values like `true`
6. **These parameters tell you to NOT add text to the PDF**

## Current Issue

The backend is receiving parameters like:
```
noText: true
hideText: true  
imageOnly: true
suppressText: true
showText: false
config: { hideText: true }
```

But the backend is **IGNORING these parameters** and still adding text to the PDF.

## The Fix

In your actual signing endpoint, add checks like:

```javascript
app.post('/sign/:link', (req, res) => {
  const { signature, placement } = req.body;
  
  // Check if text should be suppressed
  const shouldSuppressText = (
    req.body.noText === true ||
    req.body.hideText === true ||
    req.body.imageOnly === true ||
    req.body.suppressText === true ||
    req.body.showText === false ||
    req.query.notext === 'true' ||
    req.query.hidetext === 'true' ||
    req.query.imageonly === 'true'
  );
  
  console.log('Should suppress text:', shouldSuppressText);
  
  if (shouldSuppressText) {
    // ONLY add signature image to PDF
    addSignatureImageOnly(pdf, signature, placement);
  } else {
    // Add signature + text (current broken behavior)
    addSignatureWithText(pdf, signature, placement, signerInfo);
  }
});
```

## Remove Debug Endpoint

After fixing the main issue, remove the `/debug` endpoint as it's only for testing.