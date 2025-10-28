# CORS Error Fix

## Problem
The browser was blocking the signing request due to custom headers not being allowed by the backend CORS configuration:

```
[Error] Request header field X-Signature-Mode is not allowed by Access-Control-Allow-Headers.
[Error] XMLHttpRequest cannot load http://localhost:4000/sign/... due to access control checks.
```

## Root Cause
The backend server's CORS policy was not configured to accept our custom headers:
- `X-Signature-Mode`
- `X-Disable-Default-Signature`
- `X-Disable-Signature-Info`
- `X-Clean-Signature-Only`

## Solution
**Removed custom headers** and rely on the comprehensive request body parameters and query parameters instead.

### Before (Blocked by CORS):
```javascript
const signingResponse = await signerHttp.post(
  `/sign/${link}?singleSignature=true&noMetadata=true&cleanMode=true&onlyUserPlacement=true`, 
  signingPayload,
  {
    headers: {
      'X-Signature-Mode': 'SINGLE_PLACEMENT_ONLY',
      'X-Disable-Default-Signature': 'true',
      'X-Disable-Signature-Info': 'true',
      'X-Clean-Signature-Only': 'true',
      'Content-Type': 'application/json'
    }
  }
);
```

### After (CORS-friendly):
```javascript
const signingResponse = await signerHttp.post(
  `/sign/${link}?singleSignature=true&noMetadata=true&cleanMode=true&onlyUserPlacement=true`, 
  signingPayload
);
```

## Current Communication Methods

The frontend now communicates duplicate signature prevention requirements through:

### 1. Query Parameters ✅
```
?singleSignature=true&noMetadata=true&cleanMode=true&onlyUserPlacement=true
```

### 2. Request Body Parameters ✅
```javascript
{
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
  
  // ... other parameters
}
```

## Benefits
- ✅ **No CORS issues** - Uses standard HTTP methods
- ✅ **Comprehensive parameters** - 15+ different flags in request body
- ✅ **Query parameters** - Additional signals via URL
- ✅ **Backend flexibility** - Multiple ways to detect requirements

## Backend Impact
The backend should now check for:
1. **Query parameters**: `singleSignature`, `noMetadata`, `cleanMode`, `onlyUserPlacement`
2. **Request body flags**: All the duplicate prevention and metadata suppression parameters

## Testing
The signing request should now work without CORS errors, and the backend should receive all the necessary parameters to prevent duplicate signatures and metadata.

## Note
If additional communication is needed in the future, consider either:
1. **Adding more query parameters** (always allowed)
2. **Adding more request body parameters** (always allowed)
3. **Configuring backend CORS** to allow custom headers (backend change required)